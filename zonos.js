function updateDevicePlaying(device, playing) {
  $('[id="'+device.UDN+'"] .room-queue li.now-playing').removeClass('now-playing');

  // Currently playing album/radio stream artwork
  var nowPlayingAlbumArt = $('[id="'+device.UDN+'"] .room-queue li.now-playing img.album-art');
  if (nowPlayingAlbumArt.attr('src') !== undefined) {
    // Load artwork from queue
    $('#rooms-list li[id="'+device.UDN+'"] img.album-art').attr('src', nowPlayingAlbumArt.attr('src'));
  } else {
    // Load album artwork from network
    // https://developer.mozilla.org/en-US/docs/Web/API/Blob
    // http://www.html5rocks.com/en/tutorials/file/xhr2/
  
    var xhr = new XMLHttpRequest();
    xhr.open('GET', playing.albumArtURL, true);
    xhr.responseType = 'blob';
 
    xhr.onload = function() {
      if (this.status == 200) {
        var blob = new Blob([this.response], {type: 'image/jpeg'});
        var urlObject = URL.createObjectURL(blob);
        $('#rooms-list li[id="'+device.UDN+'"] img.album-art').attr('src', urlObject);
        $('[id="'+device.UDN+'"] .room-queue li.now-playing img.album-art').attr('src', urlObject);
      } else {
        $('#rooms-list li[id="'+device.UDN+'"] img.album-art').removeAttr('src');
      }
    };

    xhr.send();
  }
  
  // Artist and track information
  if (playing.isRadio) {
    $('#rooms-list li[id="'+device.UDN+'"] .artist-name').html(playing.radioShow);
    $('#rooms-list li[id="'+device.UDN+'"] .track-title').html(playing.streamContent);
  } else {
    $('#rooms-list li[id="'+device.UDN+'"] .artist-name').html(playing.artistName);
    $('#rooms-list li[id="'+device.UDN+'"] .track-title').html(playing.trackTitle);
  }

  if (playing.isQueue) {
    // Ensure queue is visible
    $('[id="'+device.UDN+'"] .room-queue').show();

    // Toggle queue now playing track
    var queue = $('[id="'+device.UDN+'"] .room-queue li');
    if (queue.length > 0) {
      $(queue[playing.queueTrackId-1]).addClass('now-playing');
      $(queue).closest('div').scrollTo($(queue[playing.queueTrackId-1]),{offset:-45,duration:500});
    }
  } else {
    // Hide queue for streaming/radio playback
    $('[id="'+device.UDN+'"] .room-queue').hide();
  }

  $('[id="'+device.UDN+'"].room-info').data('playing', playing);

  // Room control buttons
  if (playing.state == 'STOPPED' || playing.state == 'PAUSED_PLAYBACK') {
    $('[id="'+device.UDN+'"] .room-control .play-button').show();
    $('[id="'+device.UDN+'"] .room-control .pause-button').hide();
    $('[id="'+device.UDN+'"] .room-control .stop-button').hide();
    $('[id="'+device.UDN+'"] .room-control .prev-button').prop('disabled', true);
    $('[id="'+device.UDN+'"] .room-control .next-button').prop('disabled', true);
  } else { // PLAYING
    $('[id="'+device.UDN+'"] .room-control .play-button').hide();
  
    if (playing.isRadio) {
      $('[id="'+device.UDN+'"] .room-control .pause-button').hide();
      $('[id="'+device.UDN+'"] .room-control .stop-button').show();
      $('[id="'+device.UDN+'"] .room-control .prev-button').prop('disabled', true);
      $('[id="'+device.UDN+'"] .room-control .next-button').prop('disabled', true);
    } else {
      $('[id="'+device.UDN+'"] .room-control .stop-button').hide();
      $('[id="'+device.UDN+'"] .room-control .pause-button').show();
      $('[id="'+device.UDN+'"] .room-control .prev-button').prop('disabled', false);
      $('[id="'+device.UDN+'"] .room-control .next-button').prop('disabled', false);
    }
  }
}

function handlePlayingEvent(device, event) {
  var trackMetaData = $.parseXML($(event).find('CurrentTrackMetaData').attr('val'));
  if (! trackMetaData) return;

  var playing = {isRadio:false,isOther:false,isQueue:false};
  if ($(trackMetaData).find('radioShowMd').text().length) {
    playing['isRadio'] = true;
    playing['radioShow'] = decodeURIComponent(escape($(trackMetaData).find('radioShowMd').text().split(',')[0]));
    if ($(trackMetaData).find('streamContent').text().length) {
      playing['streamContent'] = decodeURIComponent(escape($(trackMetaData).find('streamContent').text()));
    }
  } else if ($(trackMetaData).find('artist').length == 0) {
    // Queue playback uses creator tag and has artist tag undefined
    playing['isQueue'] = true;
    playing['artistName'] = decodeURIComponent(escape($(trackMetaData).find('creator').text()));
    playing['trackTitle'] = decodeURIComponent(escape($(trackMetaData).find('title').text()));
    playing['trackDuration'] = $(event).find('CurrentTrackDuration').attr('val');
    playing['queueTrackId'] = parseInt($(event).find('currenttrack').attr('val'));
  } else {
    playing['isOther'] = true;
    playing['artistName'] = decodeURIComponent(escape($(trackMetaData).find('artist').text()));
    playing['trackTitle'] = decodeURIComponent(escape($(trackMetaData).find('title').text()));
  }

  if ($(trackMetaData).find('albumArtURI').text().length) {
    playing['albumArtURL'] = device.endpointURI+$(trackMetaData).find('albumArtURI').text();
  } else {
    // TODO: We should have a default artwork
    playing['albumArtURL'] = undefined;
  }
  
  playing['state'] = $(event).find('TransportState').attr('val');

  updateDevicePlaying(device, playing);
}

function handleVolumeEvent(device, event) {
  var volume = $(event).find('Volume[channel="Master"]').attr('val');

  $('[id="'+device.UDN+'"] .room-control .volume-slider').val(volume);

  if (volume == 0) {
    $('[id="'+device.UDN+'"] .room-control .volume-down').attr('src', 'mute.png');
  } else {
    $('[id="'+device.UDN+'"] .room-control .volume-down').attr('src', 'volume-down.png');
  }
}

function handleQueueEvent(device, event) {
  device.callServiceAction('Queue','Browse', {QueueID:0,StartingIndex:0,RequestedCount:0},
    function(device, result) {
      var queue = $.parseXML(result.Result);
      var playing = $('[id="'+device.UDN+'"].room-info').data('playing');

      // Clear current queue
      $('[id="'+device.UDN+'"] .room-queue').html('');

      $(queue).find('item').each(
        function(index) {
          var trackURI = $(this).find('res').text();
          var artistName = $(this).find('creator').text();
          var trackTitle = $(this).find('title').text();
          var albumTitle = $(this).find('album').text();
          $('[id="'+device.UDN+'"] .room-queue').append('<li><img class="album-art"><span class="artist-name">'+artistName+'</span><span class="album-title">'+albumTitle+'</span><span class="track-title">'+trackTitle+'</span>');

          if (playing && playing.queueTrackId && playing.queueTrackId-1 == index) {
            $('[id="'+device.UDN+'"] .room-queue li').last().addClass('now-playing');
            $('[id="'+device.UDN+'"] .room-queue li').last().find('img.album-art').attr('src', $('#rooms-list li[id="'+device.UDN+'"] img.album-art').attr('src'));
            $('[id="'+device.UDN+'"] .room-queue').scrollTo($('[id="'+device.UDN+'"] .room-queue li.now-playing'),{offset:-45});
          }

         $('[id="'+device.UDN+'"] .room-queue li').last().click(
           function() {
             if ($(window).data('windowFocus') === true) return;

             if ($(this).hasClass('now-playing')) {
               // Click on now playing to play/pause
               if ($('[id="'+device.UDN+'"] .pause-button').is(':visible')) {
                 $('[id="'+device.UDN+'"] .pause-button').trigger('click');
               } else {
                 $('[id="'+device.UDN+'"] .play-button').trigger('click');
               }
             } else {
               // Click to seek track
               device.callServiceAction('AVTransport', 'Seek', {InstanceID:0,Unit:'TRACK_NR',Target:$(this).index()+1}, function(){});
             }
           }
         );
        }
      );
    }
  );
}

function handleGroupCoordinatorEvent(device, event) {
  if (event.text() === '1') {
    $('#rooms-list [id="'+device.UDN+'"]').show();
  } else {
    // Hide non-coordinator room
    $('#rooms-list [id="'+device.UDN+'"]').hide();
  }

  // Get group information and update group members and coordinator
  device.__proto__ = UpnpDevice.prototype;
  device.callServiceAction('ZoneGroupTopology', 'GetZoneGroupAttributes', {}, function(device, result) {
    var members = result.CurrentZonePlayerUUIDsInGroup.split(',');
    var coordinator = members[0];

    // Set group coordinator class if there is more than one members in the group
    if (members.length > 1) {
      $('[id="uuid:'+coordinator+'"]').addClass('group-coordinator');
    }
  });
}

function showDeviceDetail(device) {
  $('div[id="'+device.UDN+'"]').show();
  if ($('[id="'+device.UDN+'"] .room-queue li.now-playing').length) {
    // Scroll to currently playing item
    $('[id="'+device.UDN+'"] .room-queue').scrollTo($('[id="'+device.UDN+'"] .room-queue li.now-playing'),{offset:-45});
  }
  $('#rooms-list').hide();
}

function addDiscoveredDevice(device) {
  $('#searching').hide();
  $('#rooms-list').parent().append('<div id="'+device.UDN+'" class="room-info"><input type="image" src="close.png" class="close-button"><div class="room-control"><span class="room-name">'+device.roomName+'</span><div class="volume-control"><img src="volume-down.png" class="volume-down"><input type="range" class="volume-slider" min="0" max="100" value="0"><img src="volume-up.png" class="volume-up"></div><input type="image" src="prev.png" class="prev-button"><input type="image" src="play.png" class="play-button"><input type="image" src="pause.png" class="pause-button"><input type="image" src="stop.png" class="stop-button"><input type="image" src="next.png" class="next-button"></div><ol class="room-queue"></ol></div>');
      
  $('div[id="'+device.UDN+'"] .close-button').click(function(){
    $('#rooms-list').show();
    $('div[id="'+device.UDN+'"]').hide();
  });
      
  $('div[id="'+device.UDN+'"] .pause-button').click(function(){
    device.callServiceAction('AVTransport', 'Pause', {InstanceID:0}, function(){});
  });
      
  $('div[id="'+device.UDN+'"] .play-button').click(function(){
    device.callServiceAction('AVTransport', 'Play', {InstanceID:0,'Speed':1}, function(){});
  });
      
  $('div[id="'+device.UDN+'"] .stop-button').click(function(){
    device.callServiceAction('AVTransport', 'Stop', {InstanceID:0}, function(){});
  });
      
  $('div[id="'+device.UDN+'"] .prev-button').click(function(){
    device.callServiceAction('AVTransport', 'Previous', {InstanceID:0}, function(){});
  });
      
  $('div[id="'+device.UDN+'"] .next-button').click(function(){
    device.callServiceAction('AVTransport', 'Next', {InstanceID:0}, function(){});
  });
      
  $('div[id="'+device.UDN+'"] .volume-slider').change(function(){
    device.callServiceAction('RenderingControl', 'SetVolume', {InstanceID:0,Channel:'Master',DesiredVolume:this.value}, function(){});
  });
     
  $('#rooms-list ul').append('<li id="'+device.UDN+'"><div class="now-playing"><img class="album-art"><span class="room-name">'+device.roomName+'</span><span class="artist-name"/><span class="track-title"/></div>');
  $('#rooms-list ul li').last().click(function() {
    showDeviceDetail(device);
  });
}

// Receive messages from background page
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    switch(request.type) {
      case 'deviceDiscovery':
        // Discovered a new Sonos device. Check if the device is invisible
        // and hide it from the device list if needed.
        request.device.__proto__ = UpnpDevice.prototype;
        request.device.callServiceAction('DeviceProperties', 'GetInvisible', {},
          function(device, result) {
            if (result.CurrentInvisible == 1) {
              console.log('Device '+device.friendlyName+' is invisible');
            } else {
              addDiscoveredDevice(device);
            }
          }
        );
        break;

      case 'deviceEvent':
        request.device.__proto__ = UpnpDevice.prototype;
        var event = $(request.event);

        switch(event.prop('tagName')) {
          case 'LASTCHANGE':
            change = $(event.text());
            if (change.find('TransportState').length) {
              handlePlayingEvent(request.device, change);
            } else if (change.find('Volume').length) {
              handleVolumeEvent(request.device, change);
            } else if (change.attr('xmlns') === 'urn:schemas-sonos-com:metadata-1-0/Queue/') {
              handleQueueEvent(request.device, change);
            } else {
              // TODO: Mute event
              throw 'Unexpected Sonos Change event: ' + event;
            }
            break;

          case 'GROUPCOORDINATORISLOCAL':
            handleGroupCoordinatorEvent(request.device, event);
            break;

          }

        break;

      case 'discoveryTimeout':
        if ($('.room-info').length == 0) {
          $('#searching').html('<img src="warning.png"/>Your Sonos components could not be found.');
        }
        break;
    }
  }
);

$(window).focus(
  function(event){
    // Prevent events from triggering action when window just recently got focus
    $(window).data('windowFocus', true);
    setTimeout(function(){$(window).data('windowFocus', false);}, 200);
  }
);

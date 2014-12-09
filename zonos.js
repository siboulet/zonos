function updateDevicePlaying(device, playing) {
  // Update what device is currently playing

  // Update room queue
  var roomQueue = $('[id="'+device.UDN+'"] .room-queue li');
  roomQueue.removeClass('now-playing');

  $(roomQueue).parent().hide();

  if (roomQueue.length > 0 && playing.isQueue) {
    // Sometime Sonos reports it's playing from queue, when in fact it's not.
    // One example is when playing a Station on Rdio.
    // Check if currently playing song is present in queue.

    if ($(roomQueue[playing.queueTrackId]).find('.track-title').html() === playing.trackTitle) {
      // Ensure queue is visible
      $(roomQueue).parent().show();

      // Highlight currently playing song from queue
      $(roomQueue[playing.queueTrackId]).addClass('now-playing');

      // Scroll to playing song
      $(roomQueue).parent().scrollTo($(roomQueue[playing.queueTrackId]),{offset:-45,duration:500});
    }
  }

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
    if (playing.radioShowTitle) {
      $('#rooms-list li[id="'+device.UDN+'"] .artist-name').html([playing.radioName,playing.radioShowTitle].join(' - '));
    } else {
      // Unknown radio show
      $('#rooms-list li[id="'+device.UDN+'"] .artist-name').html(playing.radioName);
    }
    $('#rooms-list li[id="'+device.UDN+'"] .track-title').html(playing.radioCurrentPlaying);
  } else {
    $('#rooms-list li[id="'+device.UDN+'"] .artist-name').html(playing.artistName);
    $('#rooms-list li[id="'+device.UDN+'"] .track-title').html(playing.trackTitle);
  }

  // Attach currently playing info to room data
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
  var transportState = $(event).find('TransportState').attr('val');
  var trackMetadata = $.parseXML($(event).find('CurrentTrackMetadata').attr('val'));
  var transportMetadata = $.parseXML($(event).find('r\\:EnqueuedTransportUriMetadata').attr('val'));

  var playing = {isRadio:false,isQueue:false};
  if ($(trackMetadata).find('res').text().indexOf('x-sonosapi-stream') === 0) {
    playing.isRadio = true;
    playing.radioName = decodeURIComponent(escape($(transportMetadata).find('title').text()));
    if (transportState !== 'TRANSITIONING') {
      playing.radioShowTitle = decodeURIComponent(escape($(trackMetadata).find('radioShowMd').text().replace(/\\/g, '').split(',').slice(0,-1).join(',')));
      playing.radioCurrentPlaying = decodeURIComponent(escape($(trackMetadata).find('streamContent').text()));
    }
  } else {
    playing.isQueue = true;
    playing.artistName = decodeURIComponent(escape($(trackMetadata).find('creator').text()));
    playing.trackTitle = decodeURIComponent(escape($(trackMetadata).find('title').text()));
    playing.trackDuration = $(event).find('CurrentTrackDuration').attr('val');
    playing.queueTrackId = parseInt($(event).find('currenttrack').attr('val')) - 1; // zero-indexed
  }

  if ($(trackMetadata).find('albumArtURI').text().length) {
    playing.albumArtURL = device.endpointURI+$(trackMetadata).find('albumArtURI').text();
  } else {
    // TODO: We should have a default artwork
    playing.albumArtURL = undefined;
  }
  
  playing.state = $(event).find('TransportState').attr('val');

  updateDevicePlaying(device, playing);
}

function handleVolumeEvent(device, event) {
  var volume = $(event).find('Volume[channel="Master"]').attr('val');

  $('[id="'+device.UDN+'"] .room-control .volume-slider').val(volume);

  if (volume == 0) {
    $('[id="'+device.UDN+'"] .room-control .volume-down').attr('src', '/glyphicons/mute.png');
  } else {
    $('[id="'+device.UDN+'"] .room-control .volume-down').attr('src', '/glyphicons/volume-down.png');
  }
}

function handleQueueEvent(device, event) {
  // Queue has changed
  // Reload queue
  device.callServiceAction('Queue','Browse', {QueueID:0,StartingIndex:0,RequestedCount:0},function(device, result) {
    var queue = $.parseXML(result.Result);

    // Clear current queue
    $('[id="'+device.UDN+'"] .room-queue').empty();

    $(queue).find('item').each(function(index) {
      var li = $('<li>');
      li.append('<img class="album-art">');
      li.append('<span class="artist-name">'+$(this).find('creator').text()+'</span>');
      li.append('<span class="album-title">'+$(this).find('album').text()+'</span>');
      li.append('<span class="track-title">'+$(this).find('title').text()+'</span>');

      $('[id="'+device.UDN+'"] .room-queue').append(li);

      li.click(function() {
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
      });
    });

    // If room is currently playing something toggle now-playing update
    var playing = $('[id="'+device.UDN+'"].room-info').data('playing');
    if (playing) {
      updateDevicePlaying(device, playing);
    }
  });
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
  $('#rooms-list').parent().append('<div id="'+device.UDN+'" class="room-info"><input type="image" src="/glyphicons/close.png" class="close-button"><div class="room-control"><span class="room-name">'+device.roomName+'</span><div class="volume-control"><img src="/glyphicons/volume-down.png" class="volume-down"><input type="range" class="volume-slider" min="0" max="100" value="0"><img src="/glyphicons/volume-up.png" class="volume-up"></div><input type="image" src="/glyphicons/prev.png" class="prev-button"><input type="image" src="/glyphicons/play.png" class="play-button"><input type="image" src="/glyphicons/pause.png" class="pause-button"><input type="image" src="/glyphicons/stop.png" class="stop-button"><input type="image" src="/glyphicons/next.png" class="next-button"></div><ol class="room-queue"></ol></div>');
      
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
        // Discovered a new Sonos device.
        request.device.__proto__ = UpnpDevice.prototype;

        // Hide devices that are not zone group controlling devices.
        // For example, in a stereo pair, only one device is controlling
        // the group. That device will return a zone group name when
        // being queried for group attributes.
        request.device.callServiceAction('ZoneGroupTopology', 'GetZoneGroupAttributes', {}, function(device, result) {
          if (result.CurrentZoneGroupName) {
            addDiscoveredDevice(device);
          }
        });
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
          $('#searching').html('<img src="/glyphicons/warning.png"/>Your Sonos components could not be found.');
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

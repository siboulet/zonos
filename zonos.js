function updateDevicePlaying(device, playing) {
  if (playing.albumArtURL) {
    // Load album artwork
    // https://developer.mozilla.org/en-US/docs/Web/API/Blob
    // http://www.html5rocks.com/en/tutorials/file/xhr2/
  
    var xhr = new XMLHttpRequest();
    xhr.open('GET', playing.albumArtURL, true);
    xhr.responseType = 'blob';
 
    xhr.onload = function(e) {
      if (this.status == 200) {
        var blob = new Blob([this.response], {type: 'image/jpeg'});
        $('[id="'+device.UDN+'"] img.album-art').attr('src', URL.createObjectURL(blob));
      }
    };

    xhr.send();
  }
  
  // Artist and track information
  if (playing.isRadio) {
    $('[id="'+device.UDN+'"] .artist-name').each(function(){$(this).html(playing.radioShow);});    
    $('[id="'+device.UDN+'"] .track-title').each(function(){$(this).html(playing.streamContent);});
  } else { 
    $('[id="'+device.UDN+'"] .artist-name').each(function(){$(this).html(playing.artistName);});
    $('[id="'+device.UDN+'"] .track-title').each(function(){$(this).html(playing.trackTitle);});
  }
  
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

function handlePlayingChangeEvent(device, event) {
  var trackMetaData = $.parseXML($(event).find('CurrentTrackMetaData').attr('val'));
  if (! trackMetaData) return;
    
  var playing = {};
  if ($(trackMetaData).find('radioShowMd').text().length) {
    playing['isRadio'] = true;
    playing['radioShow'] = decodeURIComponent(escape($(trackMetaData).find('radioShowMd').text().split(',')[0]));
    if ($(trackMetaData).find('streamContent').text().length) {
      playing['streamContent'] = decodeURIComponent(escape($(trackMetaData).find('streamContent').text()));
    }
  } else {
    playing['isRadio'] = false;
    playing['artistName'] = decodeURIComponent(escape($(trackMetaData).find('creator').text()));
    playing['trackTitle'] = decodeURIComponent(escape($(trackMetaData).find('title').text()));
  }

  playing['albumArtURL'] = device.endpointURI+$(trackMetaData).find('albumArtURI').text();
  
  playing['state'] = $(event).find('TransportState').attr('val');
 
  updateDevicePlaying(device, playing);
}

function handleVolumeChangeEvent(device, event) {
  var volume = $(event).find('Volume[channel="Master"]').attr('val');

  $('[id="'+device.UDN+'"] .room-control .volume-slider').val(volume);

  if (volume == 0) {
    $('[id="'+device.UDN+'"] .room-control .volume-down').attr('src', 'mute.png');
  } else {
    $('[id="'+device.UDN+'"] .room-control .volume-down').attr('src', 'volume-down.png');
  }
}

function showRoomDetail(device) {
  $('div[id="'+device.UDN+'"]').show(100);
  $('#rooms-list').hide();
}

function addDiscoveredRoom(device) {
  $('#searching').hide();
  $('#rooms-list').parent().append('<div id="'+device.UDN+'" class="room-info"><input type="image" src="close.png" class="close-button"><div class="room-control"><span class="room-name">'+device.roomName+'</span><div class="volume-control"><img src="volume-down.png" class="volume-down"><input type="range" class="volume-slider" min="0" max="100" value="0"><img src="volume-up.png" class="volume-up"></div><input type="image" src="prev.png" class="prev-button"><input type="image" src="play.png" class="play-button"><input type="image" src="pause.png" class="pause-button"><input type="image" src="stop.png" class="stop-button"><input type="image" src="next.png" class="next-button"></div><div class="now-playing"><h1>NOW PLAYING</h1><img class="album-art"><span class="artist-name"/><span class="track-title"/></div></div>');
      
  $('div[id="'+device.UDN+'"] .close-button').click(function(){
    $('#rooms-list').show();
    $('div[id="'+device.UDN+'"]').hide();
  });
      
  $('div[id="'+device.UDN+'"] .pause-button').click(function(){
    device.callServiceAction('AVTransport', 'Pause', {'InstanceID':0}, function(){});
  });
      
  $('div[id="'+device.UDN+'"] .play-button').click(function(){
    device.callServiceAction('AVTransport', 'Play', {'InstanceID':0,'Speed':1}, function(){});
  });
      
  $('div[id="'+device.UDN+'"] .stop-button').click(function(){
    device.callServiceAction('AVTransport', 'Stop', {'InstanceID':0}, function(){});
  });
      
  $('div[id="'+device.UDN+'"] .prev-button').click(function(){
    device.callServiceAction('AVTransport', 'Previous', {'InstanceID':0}, function(){});
  });
      
  $('div[id="'+device.UDN+'"] .next-button').click(function(){
    device.callServiceAction('AVTransport', 'Next', {'InstanceID':0}, function(){});
  });
      
  $('div[id="'+device.UDN+'"] .volume-slider').change(function(){
    device.callServiceAction('RenderingControl', 'SetVolume', {'InstanceID':0,'Channel':'Master','DesiredVolume':this.value}, function(){});
  });
     
  $('#rooms-list ul').append('<li id="'+device.UDN+'"><img class="album-art"><span class="room-name">'+device.roomName+'</span><span class="artist-name"/><span class="track-title"/>');
  $('#rooms-list ul li').last().click(function() {
    showRoomDetail(device);
  });
}

// Receive messages from background page
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    switch(request.type) {
      case 'deviceDiscovery':
        request.device.__proto__ = UpnpDevice.prototype;
        request.device.callServiceAction('DeviceProperties', 'GetInvisible', {},
          function(device, result) {
            if (result.CurrentInvisible == 1) {
              console.log('Device '+device.friendlyName+' is invisible');
            } else {
              addDiscoveredRoom(device);
            }
          }
        );
        break;

      case 'deviceEvent':
        request.device.__proto__ = UpnpDevice.prototype;
        var event = $(request.event);
        if (event.find('TransportState').length) {
          handlePlayingChangeEvent(request.device, event);
        } else if (event.find('Volume').length) {
          handleVolumeChangeEvent(request.device, event);
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

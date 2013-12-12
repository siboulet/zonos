var upnpEventListener = null;

function upnpEventCallback(device, event) {
  chrome.runtime.sendMessage({
    type: 'deviceEvent',
    device: device,
    event: event
  });
}

function discoveryDeviceCallback(device) {
  chrome.runtime.sendMessage({
    type: 'deviceDiscovery',
    device: device
  });

  // TODO: Allow foreground page to signal not to listen for events for this device
  // This would allow to ignore events for invisible Sonos devices
  // Track changes, play/stop events
  upnpEventListener.subscribeServiceEvent(device, 'AVTransport', upnpEventCallback);

  // Volume control events
  upnpEventListener.subscribeServiceEvent(device, 'RenderingControl', upnpEventCallback);

  // Queue change events
  upnpEventListener.subscribeServiceEvent(device, 'Queue', upnpEventCallback);
}

function discoveryTimeoutCallback() {
  chrome.runtime.sendMessage({
    type: 'discoveryTimeout'
  });
}

chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('zonos.html', {
    id: '',
    singleton: true,
    bounds: {
      width: 400,
      height: 500
    },
    resizable: false
  });

  upnpEventListener = new UpnpEventListener(3400, upnpEventCallback);
  new UpnpDiscovery(discoveryDeviceCallback, discoveryTimeoutCallback, 'urn:schemas-upnp-org:device:ZonePlayer:1');
});

chrome.runtime.onSuspend.addListener(function() {
  chrome.socket.destroy(upnpEventListener.socketId);
});

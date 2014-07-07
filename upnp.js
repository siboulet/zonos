// From https://developer.chrome.com/trunk/apps/app_hardware.html
var str2ab=function(str) {
  var buf=new ArrayBuffer(str.length);
  var bufView=new Uint8Array(buf);
  for (var i=0; i<str.length; i++) {
    bufView[i]=str.charCodeAt(i);
  }
  return buf;
}

// From https://developer.chrome.com/trunk/apps/app_hardware.html
var ab2str=function(buf) {
  return String.fromCharCode.apply(null, new Uint8Array(buf));
};

function UpnpDevice(location, data) {
  var _this = this;

  $(data).find('device').first().children().each(
    function() {
      if (this.childNodes.length === 1) {
        _this[this.tagName] = this.textContent;
      }
    }
  );

  _this['services'] = {};
  $(data).find('serviceList service').each(
    function() {
      var serviceName = $(this).find('serviceId').text().split(':').pop();
      _this['services'][serviceName] = {
        subscribeURL: $(this).find('eventSubURL').text(),
        serviceType: $(this).find('serviceType').text(),
        controlURL: $(this).find('controlURL').text()
      };
    }
  );
  
  // https://gist.github.com/jlong/2428561
  var endpoint = document.createElement('a');
  endpoint.href = location;
  this.endpointHostname = endpoint.hostname;
  this.endpointPort = parseInt(endpoint.port);
  this.endpointURI = endpoint.protocol+'//'+endpoint.host;
}

function UpnpEventListener(port, eventCallback) {
  var _this = this;
  this.port = port;
  this.socketId = null;
  this.subscriptions = {};

  chrome.socket.create('tcp',
    function(socket) {
      _this.socket = socket.sockedId;

      chrome.socket.listen(socket.socketId, '0.0.0.0', port,
        function(result) {
          if (result !== 0) {
            throw chrome.runtime.lastError.message;
          }

          console.log('Listening for UPnP events on port '+port);

          var accept = function(incoming) {
            // Continue to accept connections
            chrome.socket.accept(socket.socketId, accept);

            var contentLength = -1;
            var content = "";
            var subscriptionId = null;

            var read = function read(recv) {
              var data = ab2str(recv.data);

              if (! content) {
                contentLength = parseInt(data.substring(data.search('CONTENT-LENGTH: ') + 16));
                subscriptionId = data.substring(data.search('SID: ') + 5).split('\n')[0];
                data = data.substring(data.search('\r\n\r\n') + 4);
              }

              content += data;

              if (content.length != contentLength) {
                // Read more
                chrome.socket.read(incoming.socketId, read);
              } else {
                var message = str2ab('HTTP/1.1 200 OK\r\nConnection: close\r\n');
                chrome.socket.write(incoming.socketId, message,
                  function() {
                    chrome.socket.disconnect(incoming.socketId);
                    chrome.socket.destroy(incoming.socketId);
                  }
                );

                $($.parseXML(content)).find('property').each(function(){
                  eventCallback(_this.subscriptions[subscriptionId], $(this).html());
                });
              }
            };

            chrome.socket.read(incoming.socketId, read);
          };

          chrome.socket.accept(socket.socketId, accept);
        }
      );
    }
  );
}

UpnpEventListener.prototype.subscribeServiceEvent = function(device, serviceName, eventCallback) {
  var _this = this;

  if (typeof device['services'][serviceName] == 'undefined') {
    throw 'Device does not support service "'+serviceName+'"';
  }

  var subscribeURL = device.endpointURI + device['services'][serviceName].subscribeURL;

  chrome.socket.create('tcp',
    function(socket) {
      chrome.socket.connect(socket.socketId, device.endpointHostname, device.endpointPort,
        function(result) {
          chrome.socket.getInfo(socket.socketId,
            function(result) {
              var localAddress = result.localAddress;
              var message = str2ab('SUBSCRIBE '+subscribeURL+' HTTP/1.1\nHOST: '+device.endpointHostname+':'+device.endpointPort+'\nCALLBACK: <http://'+localAddress+':'+_this.port+'/>\nNT: upnp:event\nTIMEOUT: Second-3600\n\n');

              chrome.socket.write(socket.socketId, message,
                function(result) {
                  chrome.socket.read(socket.socketId,
                    function(recv) {
                      var data = ab2str(recv.data);
                      var subscriptionId = data.substring(data.search('SID: ') + 5).split('\n')[0];
                      _this.subscriptions[subscriptionId] = device;
                      chrome.socket.destroy(socket.socketId);
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
};

UpnpDevice.prototype.callServiceAction = function(serviceName, actionName, actionArguments, actionCallback) {
  var _this = this;
  var serviceType = this['services'][serviceName].serviceType;
  var controlURL = this['services'][serviceName].controlURL;
  var soapAction = 'urn:upnp-org:serviceId:'+serviceName+'#'+actionName;

  // Build XML SOAP request
  var soap = '<?xml version="1.0" encoding="utf-8"?><s:Envelope s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><u:'+actionName+' xmlns:u="'+serviceType+'">';
  $.each(actionArguments, function(key, val) { soap += '<'+key+'>'+val+'</'+key+'>'; });
  soap += '</u:'+actionName+'></s:Body></s:Envelope>';

  $.ajax({
    type: "POST",
    url: this.endpointURI+controlURL,
    contentType: 'text/xml; charset=UTF-8',
    dataType: 'xml',
    processData: false,
    data: soap,
    headers: { 'SOAPAction': soapAction },
    success: function(result) {
      var responseArguments = {};
      $(result).find(actionName+'Response').children().each(
        function() {
          responseArguments[this.tagName] = this.textContent;
        }
      );
      actionCallback(_this, responseArguments);
    }
  });
};

function UpnpDiscovery(deviceCallback, timeoutCallback, searchTarget) {
  const DISCOVER_INTERVAL = 2000; // 2 seconds
  const DISCOVER_TIMEOUT = 20000; // 20 seconds

  // Default to ssdp:all
  searchTarget = typeof searchTarget !== 'undefined' ? searchTarget : 'ssdp:all';

  chrome.socket.create('udp',
    function(socket) {
      var timeLeft = DISCOVER_TIMEOUT;
      var devicesFound = [];

      var discover = function(result) {
        // Send UPnP discovery message
        var message = str2ab('M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: \"ssdp:discover\"\r\nMX: 10\r\nST: '+searchTarget+'\r\n\r\n');
        chrome.socket.sendTo(socket.socketId, message, '239.255.255.250', 1900, function(result){});
      }

      chrome.socket.bind(socket.socketId, '0.0.0.0', 1901, discover);

      var timeout = function() {
        timeLeft -= DISCOVER_INTERVAL;
        if (timeLeft <= 0) {
          chrome.socket.destroy(socket.socketId);
          timeoutCallback();
        } else {
          window.setTimeout(timeout, timeLeft > DISCOVER_INTERVAL ? DISCOVER_INTERVAL : timeLeft);
          discover();
        }
      };

      window.setTimeout(timeout, DISCOVER_INTERVAL);

      var read = function(recv) {
        chrome.socket.recvFrom(socket.socketId,
          function(recv) {
            if (jQuery.inArray(recv.address, devicesFound) === -1) {
              var data = ab2str(recv.data);
              var location = data.substring(data.search('LOCATION: ')).split(' ')[1].split('\n')[0];

              devicesFound.push(recv.address);

              $.get(location,
                function(data) {
                  deviceCallback(new UpnpDevice(location, data));
                }
              , 'xml');
            }

            if (recv.resultCode >= 0) {
              read();
            }
          }
        );
      };

      read();
    }
  );
};

var irc = (function(socket, nickname, password, channels)
{ var dom = require('xmldom').DOMParser;
  var fetch = require('node-fetch');
  var url = require('url-regex')();
  var data;

  function urbandict(match) { fetch('http://api.urbandictionary.com/v0/define?term=' + encodeURIComponent(match[3])).then(res => res.json()).then(res => { var list = res['list'];
                                                                                                                                                           var x = Number(match[2] || 0);
                                                                                                                                                           if (x >= 0 && x < list.length) { socket.write('PRIVMSG ' + match[1] + ' :' + match[3] + ' [' + x + '/' + list.length + ']: ' + list[x]['definition'] + '\r\n'); }
                                                                                                                                                           else { socket.write('PRIVMSG ' + match[1] + ' :I see your request for ' + match[3] + ' [' + x + '/' + list.length + '] and I don\'t like it.\r\n'); }
                                                                                                                                                         });
                            }

  function urlscrape(match) { var m = match[2].match(url);
                              if (m === null) { return; }
                              m.forEach(function(u){ fetch(u).then(res => res.text()).then(res => { var title = (new dom()).parseFromString(res).getElementsByTagName('title');
                                                                                                    if (title.length == 0) { return; }
                                                                                                    socket.write('PRIVMSG ' + match[1] + ' :<' + u + '> -- ' + title[0].childNodes + '\r\n');
                                                                                                  });
                                                   });
                            } 

  var h = [ { 'pattern': /^PING( .*)?$/
            , 'handler': (match) => { socket.write('PONG' + match[0] + '\r\n'); }
            }
          , { 'pattern': /^\:[^ ]+ 001/
            , 'handler': (match) => { socket.write('JOIN ' + channels + '\r\n'); }
            }
          , { 'pattern': /^\:[^ ]+ 437 [^ ]+ ([^ ]+)/
            , 'handler': (match) => { socket.write('NICK ' + match[0] + '`\r\n'); }
            }
          , { 'pattern': /^\:([^ !]+)(?:\![^ ]+)? PRIVMSG (\#[^ ]+) \:\.ud (?:(\d+) )?(.*)$/
            , 'handler': urbandict
            }
          , { 'pattern': /^\:([^ !]+)(?:\![^ ]+)? (?:PRIVMSG|NOTICE) (\#[^ ]+) \:(.*)$/
            , 'handler': urlscrape
            }
          ];

  socket.on('connect', () => { socket.write((password && 'PASS ' + password + '\r\n') +
                                            'NICK ' + nickname + '\r\n' +
                                            'USER ' + nickname + ' 0 * :' + nickname + '\r\n'); });
  socket.on('data', (part) => { data += part;
                                var head = 0, newline = /[\r\n]/g;
                                while (newline.exec(data) !== null)
                                { var line = data.substring(head, newline.lastIndex - 1);
                                  for (var x = 0; x < h.length; x++)
                                  { var m = line.match(h[x].pattern);
                                    if (m !== null) { h[x].handler(m.slice(1)); }
                                  }
                                  head = newline.lastIndex;
                                }
                                data = data.substring(head);
                              });

  return socket;
});

irc(require('tls').connect({ 'host': 'irc.freenode.net'
                           , 'port': '7000' }), 'Sebibot', '', '##newboston');
irc(require('net').connect({ 'host': 'irc.librairc.net'
                           , 'port': '6667' }), 'Sebibot', '', '#potty');

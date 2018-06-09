var irc = (function(socket, nickname, password, channel)
{ var dom = require('xmldom').DOMParser;
  var fetch = require('node-fetch');
  var url = require('url-regex')(), history = [];
  var nodemw = require('nodemw');
  var data;

  function msg(socket, destination, message) { var cmd = 'PRIVMSG ' + destination + ' :' + message;
                                               socket.write(cmd.substr(0,510).replace(/[\r\n]/g, ' ').replace(/ +/g,' ') + '\r\n');
                                             }

  function urbandict(match) { fetch('http://api.urbandictionary.com/v0/define?term=' + encodeURIComponent(match[3])).then(res => res.json()).then(res => { var list = res['list'];
                                                                                                                                                           var x = Number(match[2] || 1);
                                                                                                                                                           if (x > 0 && x <= list.length) { msg(socket, match[1], match[3] + ' [' + x + '/' + list.length + ']: ' + list[x - 1]['definition']); }
                                                                                                                                                           else { msg(socket, match[1], 'I see your request for ' + match[3] + ' and I don\'t like it.'); }
                                                                                                                                                         });
                            }

  function urlscrape(match) { var m = match[2].match(url);
                              if (m === null) { return; }
                              m.forEach(function(u){ var index = history.indexOf(u);
                                                     if (index < 0 || u.Date.now() - history[index].time > 900000) {
                                                         fetch(u).then(res => res.text()).then(res => { var title = (new dom()).parseFromString(res).getElementsByTagName('title');
                                                                                                        if (title.length == 0) { return; }
                                                                                                        msg(socket, match[1], '<' + u + '> -- ' + title[0].childNodes);
                                                                                                      });
                                                     }
                                                     if (index < 0) { index = history.push(u) - 1; }
                                                     history[index].time = u.time;
                                                   });
                            } 

  var h = [ { 'pattern': /^PING( .*)?$/
            , 'handler': (match) => { socket.write('PONG' + match[0] + '\r\n'); }
            }
          , { 'pattern': /^\:[^ ]+ 001/
            , 'handler': (match) => { socket.write('JOIN ' + channel + '\r\n' +
                                                   'MODE ' + channel + '+s-n\r\n'); }
            }
          , { 'pattern': /^\:[^ ]+ 437 [^ ]+ ([^ ]+)/
            , 'handler': (match) => { socket.write('NICK ' + match[0] + '`\r\n'); }
            }
          , { 'pattern': /^\:([^ !]+)(?:\![^ ]+)? (?:PRIVMSG|NOTICE|332 [^ ]+) (\#[^ ]+) \:\.nick (.*)$/
            , 'handler': (match) => { if (match[1] != channel) { return; }
                                      socket.write('NICK ' + match[2] + '\r\n'); }
            }
          , { 'pattern': /^\:([^ !]+)(?:\![^ ]+)? (?:PRIVMSG|NOTICE|332 [^ ]+) (\#[^ ]+) \:\.join (.*)$/
            , 'handler': (match) => { if (match[1] != channel) { return; }
                                      socket.write('JOIN ' + match[2] + '\r\n'); }
            }
          , { 'pattern': /^\:([^ !]+)(?:\![^ ]+)? (?:PRIVMSG|NOTICE|332 [^ ]+) (\#[^ ]+) \:\.part (.*)$/
            , 'handler': (match) => { if (match[1] != channel) { return; }
                                      socket.write('PART ' + match[2] + '\r\n'); }
            }
          , { 'pattern': /^\:([^ !]+)(?:\![^ ]+)? (?:PRIVMSG|NOTICE|332 [^ ]+) (\#[^ ]+) \:\.msg ([^ ]+) (.*)$/
            , 'handler': (match) => { if (match[1] != channel) { return; }
                                      socket.write('PRIVMSG ' + match[2] + ' :' + match[3] + '\r\n'); }
            }
          , { 'pattern': /^\:([^ !]+)(?:\![^ ]+)? (?:PRIVMSG|NOTICE|332 [^ ]+) (\#[^ ]+) \:\.note ([^ ]+) (.*)$/
            , 'handler': (match) => { if (match[1] != channel) { return; }
                                      socket.write('NOTICE ' + match[2] + ' :' + match[3] + '\r\n'); }
            }
          , { 'pattern': /^\:([^ !]+)(?:\![^ ]+)? (?:PRIVMSG|NOTICE|332 [^ ]+) (\#[^ ]+) \:\.mode ([^ ]+) (.*)$/
            , 'handler': (match) => { if (match[1] != channel) { return; }
                                      socket.write('MODE ' + match[2] + ' ' + match[3] + '\r\n'); }
            }
          , { 'pattern': /^\:([^ !]+)(?:\![^ ]+)? (?:PRIVMSG|NOTICE) (\#[^ ]+) \:\.ud (?:(\d+) )?(.*)$/
            , 'handler': urbandict
            }
          , { 'pattern': /^\:([^ !]+)(?:\![^ ]+)? (?:PRIVMSG|NOTICE) (\#[^ ]+) \:\.(src|source|github)$/
            , 'handler': (match) => { socket.write('PRIVMSG ' + match[1] + ' :My source code can be found at https://github.com/Sebbyastian/newbotonian/blob/master/irc.js\r\n'); }
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
                           , 'port': '7000' }), 'Sebibot', '', '#secret');
irc(require('net').connect({ 'host': 'irc.librairc.net'
                           , 'port': '6667' }), 'Sebibot', '', '#secret');

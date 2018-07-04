var irc = (function(socket, context)
{ var i = '', o = [], nickname = context.me.name;
  function raw(cmd) { socket.write(cmd.substr(0,510).replace(/[\r\n]/g, ' ').replace(/ +/g,' ') + '\r\n'); }
  function msg(destination, message) { raw(`PRIVMSG ${destination} :${message}`); }
  function lower(c) { var pos = context.upper.indexOf(c);
                      return pos >= 0 ? context.lower[pos]
                                      : c;
                    }
  function equal(x, y) { return x.split('').map(lower).join('') == y.split('').map(lower).join(''); }

  var h = [ { 'pattern': /^PING( .*)?$/
            , 'handler': (match) => { socket.write(`PONG${match[0]}\r\n`); }
            }
          , { 'pattern': /^\:[^ ]+ 001/
            , 'handler': (match) => { context.me.registered = true;
                                      context.me.stream.put({ 'event': 'connect' });
                                      socket.write(`JOIN ${context.channel.map(c_ => c_.name).join(',')}\r\n`);
                                    }
            }
          , { 'pattern': /^\:[^ ]+ 005 (?:[^ ]+ )+?MODES\=(\d+)/
            , 'handler': (match) => { context.channel.mode.field_length = parseInt(match[0]); }
            }
          , { 'pattern': /^\:[^ ]+ 005 (?:[^ ]+ )+?CASEMAPPING\=([^ ]+)/
            , 'handler': (match) => { switch (match[0])
                                      { case 'ascii':          context.lower = context.lower.replace(/[\{\}\|]/,'');
                                                               context.upper = context.upper.replace(/[\[\]\\]/,'');
                                        case 'strict-rfc1459': context.lower = context.lower.replace(/\~/,'');
                                                               context.upper = context.upper.replace(/\^/,'');
                                      }
                                    }
            }
          , { 'pattern': /^\:[^ ]+ 005 (?:[^ ]+ )+?MAXTARGETS\=(\d+)/
            , 'handler': (match) => { context.command.forEach(cmd => cmd.target_count = parseInt(match[0])); }
            }
          , { 'pattern': /^\:[^ ]+ 005 (?:[^ ]+ )+?PREFIX\=\(([^ )]+)\)([^ ]+)/
            , 'handler': (match) => { if (match[0].length != match[1].length) { return; }
                                      match[0].split('').forEach((c, x) => { var m = context.channel.mode.find(m_ => m_.alpha == c);
                                                                             if (m === undefined) { context.channel.mode.push(m = { 'alpha': c }); }
                                                                             m.graph = match[1][x];
                                                                             m.param = { '-': (c_, arg) => { arg = typeof arg == 'string' ? c_.user.find(u => equal(u.name, arg))
																				                                                          : arg;
																				                             c_.mode = c_.mode.filter(m_ => m_.mode != m || m_.user != arg);
                                                                                                             return 1;
                                                                                                           }
                                                                                       , '+': (c_, arg) => { arg = typeof arg == 'string' ? c_.user.find(u => equal(u.name, arg))
																				                                                          : arg;
																				                             m.param['-'](c_, arg);
                                                                                                             c_.mode.push({ 'mode': m
                                                                                                                          , 'user': m.graph === undefined ? undefined : arg
                                                                                                                          });
                                                                                                             return 1;
                                                                                                           }
                                                                                       };
                                                                           });
                                    }
            }
          , { 'pattern': /^\:[^ ]+ 005 (?:[^ ]+ )+?CHANMODES\=([^ ,]*),([^ ,]*),([^ ,]*),([^ ]*)/
            , 'handler': (match) => { match[0].split('').forEach((c, x) => { var m = context.channel.mode.find(m_ => m_.alpha == c);
                                                                             if (m !== undefined) { return; }
                                                                             console.log(`pushing +/-${c}`);
                                                                             context.channel.mode.push(m = { 'alpha': c
                                                                                                           , 'param': { '-': (c_, arg) => { c_.mode = c_.mode.filter(m_ => m_.mode != m || m_.arg != arg);
                                                                                                                                            return 1;
                                                                                                                                          }
                                                                                                                      , '+': (c_, arg) => { console.log(`logging list mode: +${m && m.alpha} ${arg}`);
																									    				                    c_.mode.push({ 'mode': m
                                                                                                                                                         , 'arg':  arg
                                                                                                                                                         });
                                                                                                                                            return 1;
                                                                                                                                          }
                                                                                                                      }
                                                                                                           });
                                                                           });
                                      match[1].split('').forEach((c, x) => { var m = context.channel.mode.find(m_ => m_.alpha == c);
                                                                             if (m === undefined) { context.channel.mode.push(m = { 'alpha': c }); }
                                                                             m.param = { '-': (c_, arg) => { c_.mode = c_.mode.filter(m_ => m_.mode != m);
                                                                                                             return 1;
                                                                                                           }
                                                                                       , '+': (c_, arg) => { m.param['-'](c_, arg);
                                                                                                             c_.mode.push({ 'mode': m
                                                                                                                          , 'arg':  arg
                                                                                                                          });
                                                                                                             return 1;
                                                                                                           }
                                                                                       };
                                                                           });
                                      match[2].split('').forEach((c, x) => { var m = context.channel.mode.find(m_ => m_.alpha == c);
                                                                             if (m === undefined) { context.channel.mode.push(m = { 'alpha': c }); }
                                                                             m.param = { '-': (c_, arg) => { c_.mode = c_.mode.filter(m_ => m_.mode != m);
                                                                                                             return 0;
                                                                                                           }
                                                                                       , '+': (c_, arg) => { m.param['-'](c_, arg);
                                                                                                             c_.mode.push({ 'mode': m
                                                                                                                          , 'arg':  arg
                                                                                                                          });
                                                                                                             return 1;
                                                                                                           }
                                                                                       };
                                                                           });
                                      match[3].split('').forEach((c, x) => { var m = context.channel.mode.find(m_ => m_.alpha == c);
                                                                             if (m === undefined) { context.channel.mode.push(m = { 'alpha': c }); }
                                                                             m.param = { '-': (c_, arg) => { c_.mode = c_.mode.filter(m_ => m_.mode != m);
                                                                                                             return 0;
                                                                                                           }
                                                                                       , '+': (c_, arg) => { m.param['-'](c_, arg);
                                                                                                             c_.mode.push({ 'mode': m });
                                                                                                             return 0;
                                                                                                           }
                                                                                       };
                                                                           });
                                    }
            } 
          , { 'pattern': /^\:[^ ]+ 353 [^ ]+ ([=*@]) ([^ ]+) \:(.*)$/
            , 'handler': (match) => { var c = context.channel.find(c_ => equal(c_.name, match[1]));
                                      if (c === undefined)
                                      { return;
                                      }

                                      switch (match[0])
                                      { case '=': break;
                                        case '*': context.channel.mode.find(m => m.alpha == 'p').param['+'](c, undefined); break;
                                        case '@': context.channel.mode.find(m => m.alpha == 's').param['+'](c, undefined); break;
                                      }

                                      match[2].split(' ').forEach(arg => { var head = 0, mode = [];
                                                                           while (head < arg.length)
                                                                           { var m = context.channel.mode.find(m_ => m_.graph == arg[head]);
										                                     if (m === undefined) { break; }
                                                                             mode.push(m);
                                                                             head++;
                                                                           }

                                                                           var name = arg.substring(head);
                                                                           if (head >= arg.length)
                                                                           { console.log('no beef wanted!');
																			 return;
																		   }
																		   
                                                                           var u = c.user.find(u_ => equal(u_.name, name));
                                                                           if (u === undefined)
                                                                           { c.user.push(u = { 'name': name
                                                                                             , 'channel': []
                                                                                             });
                                                                           }

                                                                           u.channel.push(c);
                                                                           mode.forEach(m => { console.log(`+${m.alpha} applied to ${name}`);
																			                   m.param['+'](c, u);
																			                 });
                                                                         });
                                    }
            }
          , { 'pattern': /^\:[^ ]+ (433|437) [^ ]+ ([^ ]+)/
            , 'handler': (match) => { if (context.me.registered) { return; }
                                      var tail_characters = '`^-_';
                                      context.me.name = nickname + tail_characters[parseInt(Math.random() * tail_characters.length)] + context.me.name.slice(nickname.length);
                                      raw(`NICK ${context.me.name}`);
                                    }
            }
          , { 'pattern': /^\:([^ !]+)(?:\![^ ]+)? JOIN ([^ ]+)$/
            , 'handler': (match) => { var c = context.channel.find(c_ => equal(c_.name, match[1]));
                                      if (c === undefined) { return; }
                                      
                                      var u = c.user.find(u_ => equal(u_.name, match[0]));
                                      if (u === undefined) { c.user.push(u = { 'name': match[0]
                                                                             , 'channel': []
                                                                             });
                                                           }
                                      if (u.channel.length == 0) { context.me.stream.put({ 'event': 'join'
                                                                                         , 'user':  u
                                                                                         });
                                                                 }

                                      u.channel.push(c);
                                      c.user.push(u);
                                      c.stream.put({ 'event':   'join'
                                                   , 'channel': c
                                                   , 'user':    u
                                                   });
                                    }
            }
          , { 'pattern': /^\:([^ !]+)(?:\![^ ]+)? PART ([^ ]+)(?: \:(.*))?$/
            , 'handler': (match) => { var c = context.channel.find(c_ => equal(c_.name, match[1]));
                                      if (c === undefined) { return; }
                                      
                                      var u = c.user.find(u_ => equal(u_.name, match[0]));
                                      if (u === undefined) { return; }

                                      c.user = c.user.filter(u_ => u_ != u);
                                      u.channel = u.channel.filter(c_ => c_ != c);

                                      c.stream.put({ 'event':   'part'
                                                   , 'channel': c
                                                   , 'user':    u
                                                   , 'message': match[2]
                                                   });

                                      if (u.channel.length == 0)
                                      { context.me.stream.put({ 'event':   'part'
                                                              , 'user':    u
                                                              , 'message': match[2]
                                                              });
                                      }
                                    }
            }
          , { 'pattern': /^\:([^ !]+)(?:\![^ ]+)? QUIT(?: \:(.*))$/
            , 'handler': (match) => { var u = context.me.user.find(u_ => equal(u_.name, match[0]));
                                      if (u === undefined) { return; }
                                      
                                      u.channel.forEach(c_ => { c_.user = c_.user.filter(u_ => u_ != u);
                                                                c_.stream.put({ 'event':   'quit'
                                                                              , 'channel': c_
                                                                              , 'user':    u
                                                                              , 'message': match[1]
                                                                              });
                                                              });

                                      context.me.stream.put({ 'event':   'quit'
                                                            , 'user':    u
                                                            , 'message': match[1]
                                                            });
                                    }
            }
          , { 'pattern': /^\:[^ ]+ PRIVMSG ([^ ]+) \:\.mode(?: (.))?$/
            , 'handler': (match) => { var mode = context.channel.find(c => c.name == match[0]).mode;
				                      if (match[1]) { mode = mode.filter(m => m.mode.alpha == match[1]); }
				                      mode.forEach(m => msg(match[0], `+${m.mode.alpha} ${m.user === undefined ? m.arg || '[nothing]' : m.user.name}`));
				                    }
            }
          , { 'pattern': /^\:([^ !]+)(?:\![^ ]+)? (?:PRIVMSG|NOTICE) ([^ ]+) \:(.*)$/
            , 'handler': (match) => { var c = equal(context.me.name, match[1]) ? context.me
                                                                               : context.channel.find(c_ => equal(c_.name, match[1]));
                                      if (c === undefined) { return; }

                                      var u = c.user.find(u_ => equal(u_.name, match[0]));
                                      if (u === undefined) { return; }

                                      c.stream.put({ 'event':   'text'
                                                   , 'user':    u
                                                   , 'channel': c
                                                   , 'message': match[2]
                                                   });
                                    }
            }
          , { 'pattern': /^\:([^ !]+)(?:\![^ ]+)? MODE ([^ ]+) ([^ ]+) (.*)?$/
            , 'handler': (match) => { var c = equal(context.me.name, match[1]) ? context.me
                                                                               : context.channel.find(c_ => equal(c_.name, match[1]));
                                      if (c === undefined) { return; }
                                      'if (c === me) { "XXX: Set user modes" }';

                                      var o = '+', p = 0, arg = (match[3] || '').split(' ');
                                      while (p < match[2].length)
                                      { var m = match[2][p++];
                                        if (/[+-]/g.exec(m))
                                        { o = m;
                                          continue;
                                        }

                                        var m = context.channel.mode.find(m_ => m_.alpha == m);
                                        if (m !== undefined && m.param[o](c, arg[0]) == 1)
                                        { var name = arg.shift();
										  console.log(`${o}${m.alpha} applied to ${name}`);										  
                                        }
                                      }
                                    }
            }
          ];

  socket.on('connect', () => { if (context.password !== undefined) { raw(`PASS ${context.password}`); }
                               context.channel = context.channel || [];
                               context.channel.forEach(c => { c.mode = [];
                                                              c.user = []
                                                            });
                               context.channel.mode = [];
                               context.command = [ { 'name': 'JOIN' ,    'target_count': 1 }        // > Parameters: <channel>{,<channel>} [<key>{,<key>}]
                                                 , { 'name': 'KICK' ,    'target_count': 1 }        // > It is possible to extend the KICK command parameters to the
                                                                                                    // > following:
                                                                                                    // > <channel>{,<channel>} <user>{,<user>} [<comment>]
                                                 , { 'name': 'LIST' ,    'target_count': 1 }        // > Parameters: [<channel>{,<channel>} [<server>]]
                                                 , { 'name': 'NAMES',    'target_count': 1 }        // > Parameters: [<channel>{,<channel>}]
                                                 , { 'name': 'NOTICE',   'target_count': 1 }        // > See PRIVMSG for more details on replies and examples.
                                                 , { 'name': 'PART',     'target_count': 1 }        // > Parameters: <channel>{,<channel>}
                                                 , { 'name': 'PRIVMSG',  'target_count': 1 }        // > <receiver> can also
                                                                                                    // > be a list of names or channels separated with commas.
                                                 , { 'name': 'WHOIS',    'target_count': 1 }        // > A comma (',') separated list of nicknames may be
                                                                                                    // > given.
                                                 ];
                               context.lower = 'abcdefghijklmnopqrstuvwxyz{}|~';
                               context.upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ[]\\^';
                               context.me = { 'name':       nickname
                                            , 'registered': false
                                            , 'channel':    []
                                            , 'stream':     context.me.stream
                                            , 'user':       { 'find': u => context.channel.reduce((p, c) => p || c.user.find(u), undefined) }
										    };
                               raw(`NICK ${context.me.name}`);
                               raw(`USER ${context.me.name} 0 * :${context.me.name}`);
                             });
  socket.on('data', (part) => { var head = 0, newline = /[\r\n]/g;
                                i += part;
                                while (newline.exec(i))
                                { var line = i.substring(head, newline.lastIndex - 1);
                                  console.log(JSON.stringify(line));
                                  for (var x = 0; x < h.length; x++)
                                  { var m = line.match(h[x].pattern);
                                    if (m !== null) { h[x].handler(m.slice(1)); }
                                  }
                                  head = newline.lastIndex;
                                }
                                i = i.substring(head);
                              });

  socket.context = context;
  socket.handler = h;
  socket.raw = raw;
  socket.msg = msg;
  return socket;
});

function stream(name, stream) { stream.forEach(c => c.put = c.put || (ev => c.write(ev)));
                                stream.put = stream.put || (ev => stream.forEach(s_ => s_.put(ev)));
                                return { 'name':   name
                                       , 'stream': stream
                                       };
                              }

function console_stream(name) { return stream(name, [ { 'put': ev => console.log(JSON.stringify(ev, function (k, v) { return v.name ? v.name : v; }) + '\n') } ]); }

/* TLS demo...
 * replace require('tls') with require('net') for plain text
 */
function freenode()
{ return irc(require('tls').connect({ 'host': 'irc.freenode.net'
                                    , 'port': '7000' }), { 'me': console_stream('Sebivor')
                                                         , 'channel': [ console_stream('##newboston') ] 
                                                         });
}

/* TLS using pinned cert */
function asc()
{ var sock = irc(require('tls').connect({ 'host': 'irc.aerospacechat.com'
	                                    , 'port': '6697'
	                                    , 'rejectUnauthorized': false }), { 'me': console_stream('Sebivor')
				     						                              , 'channel': [ console_stream('#chat') ]
					      								                  });
  sock.on('secureConnect', () => { var cert = 'F5:48:9C:13:C7:62:3B:7A:00:A5:5F:BD:F1:8F:11:F2:57:51:45:F3';
                                   if (sock.getPeerCertificate().fingerprint != cert)
                                   { sock.destroy(new Error('Fingerprint does not match'));
								   }
							     });
  return sock;
}

//var fn = freenode();
//var c = asc();

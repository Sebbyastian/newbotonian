
var irc = (function(socket, context)
{ var i = '', o = [], nickname = context.me.name;
  function raw(cmd)
  { socket.write(cmd.replace(/[\r\n]/g, ' ')
	                .replace(/ +/g,' ')
	                .substr(0,510) + '\r\n');
  }
  function msg(destination, message)
  { raw(`PRIVMSG ${destination} :${message}`);
  }
  function lower(c)
  { var pos = context.upper.indexOf(c);     // There is a default table of upper-case letters
    return pos >= 0 ? context.lower[pos]    // It gets modified depending on various 005 
                    : c;
  }
  function compare(x, y)
  { x = x.split('').map(lower).join('');
	y = y.split('').map(lower).join('');
	return (x > y) - (x < y);
  }
  function equal(x, y) { return !compare(x, y); }

  function mode_handler(match, suppress)
  { var c = equal(context.me.name, match[1])
	      ? context.me
          : context.channel.find(c_ => equal(c_.name, match[1]));
    if (c === undefined) { return; }
    
    var o = '+', p = 0, arg = (match[3] || '').split(' ');
    while (p < match[2].length)
    { var m = match[2][p++];
      if (/[+-]/g.exec(m))
      { o = m;
        continue;
      }
    
	  var m = c === context.me
	        ? default_list_mode(context.me.mode, m, { '-': 0, '+': 0 })
            : context.channel.mode.find(m_ => m_.alpha == m);
      if (m === undefined) continue;
      
      var a = m.param[o](c, arg);
      if (suppress) continue;
      
	  c.stream.put({ 'event':   'mode'
	               , 'channel': c
	               , 'op':      `${o}${m.alpha}`
	               , 'arg':     a
				   });
    }
  }
                                         
  function text_handler(match)
  { var c = equal(context.me.name, match[1])
	      ? context.me
          : context.channel.find(c_ => equal(c_.name, match[1]));
    if (c === undefined) { return; }
    
    var u = c.user.find(u_ => equal(u_.name, match[0]));
    if (u === undefined) { return; }
    
    c.stream.put({ 'event':   'text'
                 , 'channel': c
                 , 'user':    u
                 , 'text':    match[2]
                 });
  }
                                         
  function topic_handler(match, suppress)
  { var c = context.channel.find(c_ => equal(c_.name, match[1]));
    if (c === undefined) { return; }
    
    c.topic = match[2];
    if (suppress) { return; }
    
    c.stream.put({ 'event':   'topic'
	             , 'channel': c
	             , 'user':    c.user.find(u_ => equal(u_.name, match[0]))
	             , 'text':    match[2]
                 });
  }
					                      
  function list_mode(context, alpha, param)
  { var mode = context.find(m_ => m_.alpha == alpha);
	if (mode === undefined)
	{ context.push(mode = { 'alpha': alpha
                          , 'param': param
                          });
    }
    return mode;
  }
  function default_list_mode(context, alpha, param)
  { var mode = list_mode(context, alpha
	                            , { '-': (c, arg) =>
	                                     { arg = param['-'] ? arg.shift() : undefined;
										   c.mode = c.mode.filter(m => m.mode != mode || m.arg != arg);
                                           return arg;
                                         }
                                  , '+': (c, arg) =>
                                         { arg =
										   { 'mode': mode
                                           , 'arg':  param['+'] ? arg.shift() : undefined
                                           };
                                           c.mode.push(arg);
                                           return arg;
                                         }
                                  });
    return mode;
  }
  function user_list_mode(context, alpha)
  { var mode = list_mode(context, alpha, null);
	mode.param = { '-': (c, u) =>
				        { u = u.shift();
					      if (typeof u == 'string')
					        u = c.user.find(u_ => equal(u_.name, u));
						  c.mode = c.mode.filter(m => m.mode != mode || m.user != u);
                          return u;
                        }
                 , '+': (c, u) =>
                        { u = u.shift();
						  if (typeof u == 'string')
				            u = c.user.find(u_ => equal(u_.name, u));
				          mode.param['-'](c, [u]);
				          u = { 'mode': mode
                              , 'user': u
                              };
                          c.mode.push(u);
                          return u;
                        }
                 };
    return mode;
  }
                                      
  var h =
  [ { 'pattern': /^PING( .*)?$/
    , 'handler': match => socket.write(`PONG${match[0]}\r\n`)
    }
  , { 'pattern': /^\:[^ ]+ 001/
    , 'handler': match =>
                 { context.me.registered = true;
                   context.me.stream.put({ 'event': 'connect' });
                   socket.write(`JOIN ${context.channel.map(c_ => c_.name).join(',')}\r\n`);
                   context.channel.forEach(c_ => raw(`MODE ${c_.name}`));
                 }
    }
  , { 'pattern': /^\:[^ ]+ 005 (?:[^ ]+ )+?MODES\=(\d+)/
    , 'handler': match =>
                 context.channel.mode.field_length = parseInt(match[0])
    }
  , { 'pattern': /^\:[^ ]+ 005 (?:[^ ]+ )+?CASEMAPPING\=([^ ]+)/
    , 'handler': match =>
                 { switch (match[0])
                   { case 'ascii':          context.lower = context.lower.replace(/[\{\}\|]/,'');
                                            context.upper = context.upper.replace(/[\[\]\\]/,'');
                     case 'strict-rfc1459': context.lower = context.lower.replace(/\~/,'');
                                            context.upper = context.upper.replace(/\^/,'');
                   }
                 }
    }
  , { 'pattern': /^\:[^ ]+ 005 (?:[^ ]+ )+?MAXTARGETS\=(\d+)/
    , 'handler': match =>
                 context.command.forEach(cmd => cmd.target_count = parseInt(match[0]))
    }
  , { 'pattern': /^\:[^ ]+ 005 (?:[^ ]+ )+?PREFIX\=\(([^ )]+)\)([^ ]+)/
    , 'handler': match =>
                 match[0].split('')
                         .forEach((c, x) =>
                                  user_list_mode(context.channel.mode, c).graph = match[1][x])
    }
  , { 'pattern': /^\:[^ ]+ 005 (?:[^ ]+ )+?CHANMODES\=([^ ,]*),([^ ,]*),([^ ,]*),([^ ]*)/
    , 'handler': match =>
                 match.forEach((m, x) =>
				               m.split('')
				                .forEach(a =>
				                         default_list_mode(context.channel
				                                                  .mode, a, [ { '-': 1, '+': 1 }
				                                                            , { '-': 1, '+': 1 }
				                                                            , { '-': 0, '+': 1 }
				                                                            , { '-': 0, '+': 0 } ][x])))
    }
  , { 'pattern': /^\:([^ !]+)(?:\![^ ]+)? 324 [^ ]+ ([^ ]+) ([^ ]+)(?: (.*))?$/
	, 'handler': match => mode_handler(match, true)
	}
  , { 'pattern': /^\:([^ ]+) 332 [^ ]+ ([^ ]+) \:(.*)$/
    , 'handler': match => topic_handler(match, true)
    }
  , { 'pattern': /^\:[^ ]+ 353 [^ ]+ ([=*@]) ([^ ]+) \:(.*)$/
    , 'handler': match =>
                 { var c = context.channel.find(c_ => equal(c_.name, match[1]));
                   if (c === undefined) { return; }
                   
                   switch (match[0])
                   { case '=': break;
                     case '*': context.channel.mode.find(m => m.alpha == 'p').param['+'](c, undefined); break;
                     case '@': context.channel.mode.find(m => m.alpha == 's').param['+'](c, undefined); break;
                   }
                   
                   match[2].split(' ').forEach(arg =>
                                               { var head = 0, mode = [];
                                                 for (;;)
                                                 { var m = context.channel.mode.find(m_ => m_.graph == arg[head]);
								                   if (m === undefined) { break; }
                                                   mode.push(m);
                                                   if (++head >= arg.length) { return; }
                                                 }
												 
												 var name = arg.substring(head);
                                                 var u = c.user.find(u_ => equal(u_.name, name));
                                                 if (u === undefined)
                                                 { c.user.push(u = { 'name': name
                                                                   , 'channel': []
                                                                   });
                                                 }
                                                 
                                                 u.channel.push(c);
                                                 mode.forEach(m => m.param['+'](c, [u]));
                                               });
                 }
    }
  , { 'pattern': /^\:[^ ]+ (433|437) [^ ]+ ([^ ]+)/
    , 'handler': match =>
                 { if (context.me.registered) { return; }
                   var tail_characters = '`^-_';
                   context.me.name = nickname + tail_characters[parseInt(Math.random() * tail_characters.length)] + context.me.name.slice(nickname.length);
                   raw(`NICK ${context.me.name}`);
                 }
    }
  , { 'pattern': /^\:([^ !]+)(?:\![^ ]+)? JOIN ([^ ]+)$/
    , 'handler': match =>
                 { var c = context.channel.find(c_ => equal(c_.name, match[1]));
                   if (c === undefined) { return; }
                   
                   var u = context.me.user.find(u_ => equal(u_.name, match[0]));
                   if (u === undefined)
                   { c.user.push(u = { 'name': match[0]
                                     , 'channel': []
                                     });
                   }
                   if (u.channel.length == 0)
                   { context.me.stream.put({ 'event': 'join'
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
  , { 'pattern': /^\:([^ !]+)(?:\![^ ]+)? KICK ([^ ]+) ([^ ]+)(?: \:(.*))?$/
    , 'handler': match =>
                 { var c = context.channel.find(c_ => equal(c_.name, match[1]));
                   if (c === undefined) { return; }
                   
                   var u = c.user.find(u_ => equal(u_.name, match[0]));
                   if (u === undefined) { return; }
                   
                   var t = c.user.find(u_ => equal(u_.name, match[2]));
                   if (t === undefined) { return; }
                   
                   c.user = c.user.filter(u_ => u_ != t);
                   t.channel = t.channel.filter(c_ => c_ != c);
                   if (t.channel.length == 0)
                   { context.me.stream.put({ 'event': 'kick'
                                           , 'user':  t
                                           , 'text':  match[3]
                                           });
                   }
                   c.stream.put({ 'event':   'kick'
                                , 'channel': c
                                , 'source':  u
                                , 'target':  t
                                , 'text':    match[3]
                                });
                 }
    }
  , { 'pattern': /^\:([^ !]+)(?:\![^ ]+)? MODE ([^ ]+) \:?([^ ]+)(?: (.*))?$/
    , 'handler': mode_handler
    }
  , { 'pattern': /^\:([^ !]+)(?:\![^ ]+)? NICK \:?([^ ]+)$/
	, 'handler': match =>
	             { var u = context.me.user.find(u_ => equal(u_.name, match[0]));
	               if (u === undefined) { return; }
				   
				   u.name = match[1];
	               u.channel.forEach(c_ => { c_.user = c_.user.filter(u_ => u_ != u);
                                             c_.stream.put({ 'event':    'nick'
					                                       , 'old_name': match[0]
					                                       , 'user':     u
					                                       , 'channel':  c_
								                           });
                                           });
                   
				   context.me.stream.put({ 'event':    'nick'
					                     , 'old_name': match[0]
					                     , 'user':     u
								         });
				 }
	}
  , { 'pattern': /^\:([^ !]+)(?:\![^ ]+)? NOTICE ([^ ]+) \:(.*)$/
    , 'handler': text_handler
    }
  , { 'pattern': /^\:([^ !]+)(?:\![^ ]+)? PART ([^ ]+)(?: \:(.*))?$/
    , 'handler': match =>
                 { var c = context.channel.find(c_ => equal(c_.name, match[1]));
                   if (c === undefined) { return; }
                   
                   var u = c.user.find(u_ => equal(u_.name, match[0]));
                   if (u === undefined) { return; }
                   
                   c.user = c.user.filter(u_ => u_ != u);
                   u.channel = u.channel.filter(c_ => c_ != c);
                   
                   c.stream.put({ 'event':   'part'
                                , 'channel': c
                                , 'user':    u
                                , 'text':    match[2]
                                });
                   
                   if (u.channel.length == 0)
                   { context.me.stream.put({ 'event':   'part'
                                           , 'user':    u
                                           , 'text':    match[2]
                                           });
                   }
                 }
    }
  , { 'pattern': /^\:([^ !]+)(?:\![^ ]+)? PRIVMSG ([^ ]+) \:(.*)$/
    , 'handler': text_handler
    }
  , { 'pattern': /^\:[^ ]+ PRIVMSG ([^ ]+) \:\.mode(?: ([+-]?)(.+))?$/
    , 'handler': match =>
                 context.channel
                        .find(c => c.name == match[0])
                        .mode
                        .filter(m => !match[2] || (match[1] == '-' ? match[2].indexOf(m.alpha) < 0
                                                                   : match[2].indexOf(m.alpha) >= 0))
                        .forEach(m => msg(match[0], `+${m.mode.alpha} ${m.user ? m.user.name : m.arg  ? m.arg : '[nothing]' }`))
    }
  , { 'pattern': /^\:([^ !]+)(?:\![^ ]+)? QUIT(?: \:(.*))$/
    , 'handler': match =>
                 { var u = context.me.user.find(u_ => equal(u_.name, match[0]));
                   if (u === undefined) { return; }
                   
                   u.channel.forEach(c_ => { c_.user = c_.user.filter(u_ => u_ != u);
                                             c_.stream.put({ 'event':   'quit'
                                                           , 'channel': c_
                                                           , 'user':    u
                                                           , 'text':    match[1]
                                                           });
                                           });
                   
                   context.me.stream.put({ 'event':   'quit'
                                         , 'user':    u
                                         , 'text':    match[1]
                                         });
                   }
    }
  , { 'pattern': /^\:([^ !]+)(?:\![^ ]+)? TOPIC ([^ ]+) \:(.*)$/
	, 'handler': topic_handler
	}
  ];

  socket.on('connect', () => { if (context.password !== undefined) { raw(`PASS ${context.password}`); }
                               context.channel = context.channel || [];
                               context.channel.forEach(c => { c.mode = [];
                                                              c.user = [];
                                                              c.topic = undefined;
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
                               context.me = { 'mode':       []
								            , 'name':       nickname
                                            , 'registered': false
                                            , 'channel':    []
                                            , 'stream':     context.me.stream
                                            , 'user':       { 'find': u => context.channel.reduce((p, c) => p || c.user.find(u), undefined) }
										    };
                               raw(`NICK ${context.me.name}`);
                               raw(`USER ${context.me.name} 0 * :${context.me.name}`);
                             });
  socket.on('data', part =>
                    { var head = 0, newline = /[\r\n]/g;
                      i += part;
                      while (newline.exec(i))
                      { var line = i.substring(head, newline.lastIndex - 1);
                        console.log(JSON.stringify(line));
                        for (var x = 0; x < h.length; x++)
                        { var m = line.match(h[x].pattern);
                          if (m !== null) h[x].handler(m.slice(1));
                        }
                        head = newline.lastIndex;
                      }
                      i = i.substring(head);
                    });

  socket.compare = compare;
  socket.context = context;
  socket.handler = h;
  socket.raw = raw;
  socket.msg = msg;
  return socket;
});

function stream(name, stream) { stream.put = stream.put || (ev => stream.forEach(s_ => s_.put(ev)));
                                return { 'name':   name
                                       , 'stream': stream
                                       };
                              }

var console_stream = () => ({ 'put': ev => console.log(JSON.stringify(ev, (k, v) => v && v.name ? v.name : v)) });
var browser_stream = fn => require('./ui_logic.js').https_server_stream({'port': 8080}, fn);

var plain_text = require('net').connect;
var signed_tls = require('tls').connect;
var pinned_tls = socket_options =>
                 { socket_options.rejectUnauthorized = false;
				   socket_options.cert = socket_options.cert || [];
                   var sock = signed_tls(socket_options);
                   sock.on('secureConnect', () => socket_options.certificate.find(c => c === sock.getPeerCertificate().fingerprint)
                                               || sock.destroy(new Error(`Fingerprint mismatch; server suggests ${sock.getPeerCertificate().fingerprint}`))); 
                   return sock;
                 };

irc.network = { 'undernet':      [ { 'host': 'eu.undernet.org',       'port': '6667', 'method': plain_text } ]
              , 'freenode':      [ { 'host': 'irc.freenode.net',      'port': '6697', 'method': signed_tls } ]
              , 'aerospacechat': [ { 'host': 'irc.aerospacechat.com', 'port': '6697', 'method': pinned_tls, 'certificate': [ 'F5:48:9C:13:C7:62:3B:7A:00:A5:5F:BD:F1:8F:11:F2:57:51:45:F3' ] } ]
              , 'ofloo':         [ { 'host': 'irc.ofloo.net',         'port': '6994', 'method': pinned_tls, 'certificate': [ '06:BC:42:68:7B:AA:D4:89:78:D7:2F:00:33:13:D1:CE:92:C3:A9:0F' ] } ]
		      };
		      
irc.connect = function(name, context)
{ if (!irc.network[name])
  { throw new Error('unknown network name');
  }
  var head = irc.network[name].shift();
  irc.network[name].push(head);
  return irc(head.method(head), context);
};
			     
/* Soon to come...
const bsearch = require('./common.js').bsearch;
const binsert = require('./common.js').binsert;
const url = require('url');

const bs = browser_stream(m => m.forEach(m_ => fn.raw(m_)))
                                .on('request', req =>
                                               { if (url.parse(req.url).path !== '/')
												   return;
												 var name = [];
											     fn.context.channel.forEach(c => 
												                            { bs.put(c);
												                              c.user.forEach(u => binsert(u, name, (x, y) => fn.compare(x.name, y.name)));
																			});
												 name.forEach(bs.put);
											   });
*/
const cs = console_stream();

var fn = irc.connect('freenode', { 'me': stream('Sebivor', [ cs ])
							     , 'channel': [ stream('##coding', [ cs ])
								              , stream('##expression', [ cs ])
								          //    , stream('##newboston', [ bs ])
								              ]
					             });
					             /*
var asc = irc.connect('aerospacechat', { 'me': stream('Sebitest', [ console_stream() ])
							           , 'channel': [ stream('#Sebitest', [ console_stream() ])
							                        ]
					                   });
var ofl = irc.connect('ofloo', { 'me': stream('hahaHAHAHAHA', [ console_stream() ])
							   , 'channel': [ stream('#Sebitest', [ console_stream() ])
							                ]
						       });*/

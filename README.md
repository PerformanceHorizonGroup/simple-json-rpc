simple-json-rpc
===============

A very simple RPC protocol using JSON encoded messages and intending to make invoking remote methods as simple as possible (as simple as they can be in JavaScript).

## Why bother using it

It makes remote calls easier - you don't need to handle sending parameters for each call, to take care to dispatch results to the caller or to write remote method definitions (which clients to read in order to make the right call).

## Examples

The existing JS implementation can easily be used in browsers and node.js environments.

In the browser, if we assume that `new Transport()` would give us an usable messaging link, the RPC proxy can be created as:

```javascript
var transport=new Transport();
transport.onMessage=function (msg){
	rpc.onMessage(msg);
};

var rpc=new RPC({
	sendRPCMessage:function (msg){
		transport.send(msg);
	},
	remoteMethods:['sum', 'subtract']
});
``` 

and the `rpc` object is ready to be used like:

```javascript
rpc.targetObj.sum(4, 28, function (result){
	console.log("sum is "+result); // would print "sum is 32"
	
	rpc.targetObj.subtract(result, 15, function (result){
		console.log("and "+result+" is now left if we subtract 15"); // would print "and 17 is now left if we subtract 15"
	});
});
```

This will of course work if the remote side was configured like:

```javascript
var transport=new Transport();
transport.onMessage=function (msg){
	rpc.onMessage(msg);
};

var rpc=new RPC({
	sendRPCMessage:function (msg){
		transport.send(msg);
	},
	ownMethods:{
		sum:function (param1, param2, cb){
			cb(param1+param2);
		},
		subtract:function (param1, param2, cb){
			cb(param1-param2);
		}
	}
});
```

And for a node.js example we could try RPC over IPC ;) which will be like:
``` javascript
	var cluster = require('cluster'),
		RPC=require('simple-json-rpc').RPC;
	if (cluster.isMaster){
		// create the first RPC peer
		var rpc=new RPC({
			ownMethods:{
				sum:function (param1, param2, cb){
					cb(param1+param2);
				},
				subtract:function (param1, param2, cb){
					if(cb)
						cb(param1-param2);
				}
			},
			sendRPCMessage:function (msg){
				forked.send(msg);
			}
		});
		
		// now fork the other peer
		var forked=cluster.fork();
		forked.on('message', function (msg){
			rpc.onMessage(msg);
		})
	}else{
		// create the forked RPC peer
		var forkedRpc=new RPC({
			sendRPCMessage:function (msg){
				process.send(msg);
			}
		});
		process.on('message', function (msg){
			forkedRpc.onMessage(msg);
		})
	}
```

In this example the forked rpc peer is not yet capable of calling the remote methods because it doesn't know what they could be since there was no `remoteMethods:[]` in its configuration. Instead it could use a remote call to get that list:
```javascript
		forkedRpc.retrieveRemoteMethods(function (err, list){
			if(!err){
				console.log('remote methods list was received:');
				console.log(list.join(', '));
				
				// so now we can send our addition request
				forkedRpc.targetObj.sum(4, 28); // no callback given here because this time we probably 
												// already know the result will be 32 
												// though would still like to leave this as an exercise 
												// for the rpc pier in the master process ;) 
			}
		});
```

## Architecture

It's been built around peer-to-peer and not client-server because each party can expose methods to be called and at the same time call methods on the other one.

Calls are expected to execute asynchronously as most transports are asynchronous but synchronous execution is also possible.

A local proxy object is created and used to call methods on it. Each method packs the parameters it received into a JSON encoded message and sends that over the transport link to the other party. Messages look like this:
```
{
	name:"sum",
	args:[4,18],
	cbId:cb35
}
```
When the message is received the other party calls its corresponding method passing the parameters specified in the message.

What the protocol does not handle is message transport which is left to the developer. Any kind of reliable transport mechanism will do the job if it can safely get the message over to the recipient - AJAX, WebSockets, IPC, etc. (As a funny fact it's worth to mention that even snail mail will do if you don't mind the latency ;) )

## License
The MIT License, because it rules.

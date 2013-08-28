/*!
 * JSON-RPC
 * Copyright(c) 2010-2013 Georgi Kostov <p_e_a@gbg.bg>, http://performancehorizon.com
 * https://github.com/PerformanceHorizonGroup/simple-json-rpc
 * MIT Licensed
 */

(function (global){
	( ((typeof module !== 'undefined' && module.exports) ? module.exports : global).RPC = function (cfg){
		this.remoteMethods={};
		this.callbacks={};
		this.cbIds=0;
		
		if(cfg){
			/**
			 * @cfg	{Object}	targetObj	(optional)	The object which the RPC interface (exported and remote methods) will be modeled on.
			 */
			if(cfg.targetObj){
				this.targetObj=cfg.targetObj;
				delete cfg.targetObj;
			}else
				this.targetObj={};			
			this.targetObj.RPC=this;
			/**
			 * @cfg	{Function}	(optional)	sendRPCMessage	A function to call when a message needs to be sent.
			 * If not ptovided the object will not be able to send messages but that does not prevent it from accepting messages and
			 * executing the calls they request (but will not be able to respond of course).
			 */
			if(cfg.sendRPCMessage){
				this.sendRPCMessage=cfg.sendRPCMessage;
				delete cfg.sendRPCMessage;
			}else
				this.sendRPCMessage=function (){};
			/**
			 * @cfg	{Object}	ownMethods	(optional)	A hash with functions keyed by names which the object needs to export.
			 */
			if(cfg.ownMethods){
				for(var p in cfg.ownMethods)
					this.targetObj[p]=cfg.ownMethods[p];
				delete cfg.ownMethods;
			}
			/**
			 * @cfg	{String/Array}	remoteMethods	(optional) A name or an array of names of methods that the remote party provides.
			 */
			if(cfg.remoteMethods){
				this.addRemoteMethods(cfg.remoteMethods);
				delete cfg.remoteMethods;
			}
			
			// copy other properties from the configuration
			for(var p in cfg)
				this[p]=cfg[p];
		}
			
//		return this.targetObj;
	} ).prototype={
		/**
		 * @method	onRPCMessage
		 * @param	{Object}	msg	The RPC message that the object needs to process
		 */
		onRPCMessage:function (msg){
			if('name' in msg){
				var fn=null,
					scope=null;
				if(msg.name=='getExportedRPCMethods'){
					fn=this.getExportedRPCMethods;
					scope=this;
				}else if(msg.name in this.targetObj)
					fn=this.targetObj[msg.name];
				else if(msg.name in this.callbacks){
					fn=this.callbacks[msg.name];
					delete this.callbacks[msg.name];
				}
				if(fn){
					var args=msg.args,
						obj=this;
					if(msg.cbId)	// if there's a cb setup for the call
						args.push(function (){
							obj.callRemoteMethod(msg.cbId, arguments);
						});
					fn.apply(scope||this.targetObj, args);
				}
			}
		},
		/**
		 * @method	getExportedRPCMethods
		 * Returns all methods that this object implements and exports to be called remotely.
		 * @param	{Function}	cb	(optional)	A callback to use to send the result
		 * @return	{Array}	The list of own methods that the object exports.
		 */
		getExportedRPCMethods:function (cb){
			var list=[];
			for(var p in this.targetObj)
				if(this.targetObj[p] && typeof this.targetObj[p]=='function' && !(p in this.remoteMethods))
					list.push(p);
			if(cb)
				cb(null, list);
			return list;	// return in case this is not RPC call
		},
		/**
		 * @method	callRemoteMethod
		 * Prepares and sends the RPC message to call the remote method.
		 * @param	{String}	name	Remote method's name
		 * @param	{Array} args	(optional)	A list of arguments for the call.
		 */
		callRemoteMethod:function (name, args){
			var cb=null,
				cbId=null;
			args = args ? [].slice.call(args, 0) : [];	// .slice() it in case it's and arguments object
			
			// look for last parameter of type "function" and use it as a callback
			if(args.length && typeof args[args.length-1]=='function')
				cb=args.pop();
			if(cb){
				// set cbId so the other side knows to provide a callback to the invoked method
				cbId='cb'+this.cbIds++;
				this.callbacks[cbId]=cb;
			}
			this.sendRPCMessage({
				name:name,
				args:args,
				cbId:cbId
			});
		},
		/**
		 * @method	retrieveRemoteMethods
		 * When called the object will call the other side asking for its list of exported methods and will
		 * update the local remote methods hash.
		 * @param	{Function} cb	(optional)	A callback to also be given the list of remote methods.
		 */
		retrieveRemoteMethods:function (cb){
			var obj=this;
			this.callRemoteMethod('getExportedRPCMethods', [function (err, list){
				if(!err){
					obj.remoteMethods={};
					obj.addRemoteMethods(list);
				}
				if(cb)
					cb(err, list);
			}]);
		},
		/**
		 * @method	addRemoteMethods
		 * Adds a name or an array of names of methods to the local remote methods hash.
		 * @param	{String/Array} methods	A name or an array of names of remote methods.
		 */
		addRemoteMethods:function (methods){
			if(typeof methods=='string'){
				(this.targetObj)[methods]=
					this.remoteMethods[methods]=function (){
						this.RPC.callRemoteMethod(methods, arguments);
					};
			}else
				for(var i=0; i<methods.length; i++)
					this.addRemoteMethods(methods[i]);
		}
	};
}(function() {return this;}()));

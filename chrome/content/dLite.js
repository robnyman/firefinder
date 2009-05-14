/*
	Developed by Robert Nyman
	Code/licensing: http://code.google.com/p/dlite/
	Documentation: http://www.robertnyman.com/dlite
	Version 1.0
*/	
var dLite = function () {
	var isIE = /*@cc_on!@*/false;
	var uniqueHandlerId = 0;
	var DOMLoaded = false;
	var DOMLoadTimer = null;
	var functionsToCall = [];
	var addedStrings = {};
	var execFunctions = function () {
		for (var i=0, il=functionsToCall.length; i<il; i++) {
			try {
				functionsToCall[i]();
			}
			catch (e) {
				// Prevent possible reference errors
			}
		}
		functionsToCall = [];
	};
	var DOMHasLoaded = function () {
		if (DOMLoaded) {
			return;
		}
		DOMLoaded = true;
		execFunctions();
	};
	return {
		elm : function (id) {
			return document.getElementById(id);
		},
		
		elmsByClass : function (className, tag, elm){
			if (document.getElementsByClassName) {
				this.elmsByClass = function (className, tag, elm) {
					elm = elm || document;
					var elements = elm.getElementsByClassName(className),
						nodeName = (tag)? new RegExp("\\b" + tag + "\\b", "i") : null,
						returnElements = [],
						current;
					for(var i=0, il=elements.length; i<il; i+=1){
						current = elements[i];
						if(!nodeName || nodeName.test(current.nodeName)) {
							returnElements.push(current);
						}
					}
					return returnElements;
				};
			}
			else if (document.evaluate) {
				this.elmsByClass = function (className, tag, elm) {
					tag = tag || "*";
					elm = elm || document;
					var classes = className.split(" "),
						classesToCheck = "",
						xhtmlNamespace = "http://www.w3.org/1999/xhtml",
						namespaceResolver = (document.documentElement.namespaceURI === xhtmlNamespace)? xhtmlNamespace : null,
						returnElements = [],
						elements,
						node;
					for(var j=0, jl=classes.length; j<jl; j+=1){
						classesToCheck += "[contains(concat(' ', @class, ' '), ' " + classes[j] + " ')]";
					}
					try	{
						elements = document.evaluate(".//" + tag + classesToCheck, elm, namespaceResolver, 0, null);
					}
					catch (e) {
						elements = document.evaluate(".//" + tag + classesToCheck, elm, null, 0, null);
					}
					while ((node = elements.iterateNext())) {
						returnElements.push(node);
					}
					return returnElements;
				};
			}
			else {
				this.elmsByClass = function (className, tag, elm) {
					tag = tag || "*";
					elm = elm || document;
					var classes = className.split(" "),
						classesToCheck = [],
						elements = (tag === "*" && elm.all)? elm.all : elm.getElementsByTagName(tag),
						current,
						returnElements = [],
						match;
					for(var k=0, kl=classes.length; k<kl; k+=1){
						classesToCheck.push(new RegExp("(^|\\s)" + classes[k] + "(\\s|$)"));
					}
					for(var l=0, ll=elements.length; l<ll; l+=1){
						current = elements[l];
						match = false;
						for(var m=0, ml=classesToCheck.length; m<ml; m+=1){
							match = classesToCheck[m].test(current.className);
							if (!match) {
								break;
							}
						}
						if (match) {
							returnElements.push(current);
						}
					}
					return returnElements;
				};
			}
			return this.elmsByClass(className, tag, elm);
		},
		
		addClass : function (elm, className) {
			var currentClass = elm.className;
			if (!new RegExp(("(^|\\s)" + className + "(\\s|$)"), "i").test(currentClass)) {
				elm.className = currentClass + (currentClass.length? " " : "") + className;
			}
		},

		removeClass : function (elm, className) {
			var classToRemove = new RegExp(("(^|\\s)" + className + "(\\s|$)"), "i");
			elm.className = elm.className.replace(classToRemove, function (match) {
				var retVal = "";
				if (new RegExp("^\\s+.*\\s+$").test(match)) {
					retVal = match.replace(/(\s+).+/, "$1");
				}
				return retVal;
			}).replace(/^\s+|\s+$/g, "");
		},
		
		addEvent : function (elm, evt, func) {
			if (document.addEventListener) {
				this.addEvent = function (elm, evt, func) {
					elm.addEventListener(evt, func, false);
				};
			}
			else {
				this.addEvent = function (elm, evt, func) {
					if (!elm.uniqueHandlerId) {
						elm.uniqueHandlerId = uniqueHandlerId++;
					}
					var alreadyExists = false;
					if (func.attachedElements && func.attachedElements[evt + elm.uniqueHandlerId]) {
						alreadyExists = true;
					}
					if (!alreadyExists) {
						if (!elm.events) {
							elm.events = {};
						}
						if (!elm.events[evt]) {
							elm.events[evt] = [];
							var existingEvent = elm["on" + evt];
							if (existingEvent) {
								elm.events[evt].push(existingEvent);
							}
						}
						elm.events[evt].push(func);
						elm["on" + evt] = dLite.handleEvent;
						
						if (!func.attachedElements) {
							func.attachedElements = {};
						}
						func.attachedElements[evt + elm.uniqueHandlerId] = true;
					}
				};
			}
			return this.addEvent(elm, evt, func);
		},
		
		handleEvent : function (evt) {
			var currentEvt = evt || event;
			var currentTarget = currentEvt.target || currentEvt.srcElement || document;
			while (currentTarget.nodeType !== 1 && currentTarget.parentNode) {
				currentTarget = currentTarget.parentNode;
			}			
			currentEvt.eventTarget = currentTarget;
			var eventColl = this.events[currentEvt.type].slice(0);
			var eventCollLength = eventColl.length - 1;
			if (eventCollLength !== -1) {
				for (var i=0; i<eventCollLength; i++) {
					eventColl[i].call(this, currentEvt);
				}
				return eventColl[i].call(this, currentEvt);
			}
		},
		
		removeEvent : function (elm, evt, func) {
			if (document.addEventListener) {
				this.removeEvent = function (elm, evt, func) {
					elm.removeEventListener(evt, func, false);
				};
			}
			else {
				this.removeEvent = function (elm, evt, func) {
					if (elm.events) {
						var eventColl = elm.events[evt];
						if (eventColl) {
							for (var i=0; i<eventColl.length; i++) {
								if (eventColl[i] === func) {
									delete eventColl[i];
									eventColl.splice(i, 1);
								}
							}
						}
						func.attachedElements[evt + elm.uniqueHandlerId] = null;
					}
				};
			}
			return this.removeEvent(elm, evt, func);
		},
		
		stopDefault : function (evt) {
			evt.returnValue = false;
			if (evt.preventDefault) {
				evt.preventDefault();
			}
		},
		
		cancelBubbling : function (evt) {
			evt.cancelBubble = true;
			if (evt.stopPropagation) {
				evt.stopPropagation();
			}
		}
	};
}();
/*global FBL */
FBL.ns(function () {
	with (FBL) {
		var panelName = "firefinder",
			regExpClass = /\s?firefinder\-match(\-hover)?/g,
			regExpHoverClass = /firefinder\-match\-hover/,
			regExpInitialViewClass = /initial\-view/,
			regExpCollapsedClass = /collapsed/,
			regExpInspectElementClass = /firefinder\-inspect\-element/,
			regExpFriendlyFireClass = /firefinder\-friendly\-fire\-this/,
			regExpFriendlyFireURLClass = /firefinder\-friendly\-fire\-url/,
			regExpFriendlyFireCopyURLClass = /firefinder\-friendly\-fire\-copy\-url/,
			regExpSpaceFix = /^\s+|\s+$/g,
			regExpInnerCodeClass = /inner\-code\-container/,
			regExpSlashEscape = /\//g,
			regExpCharacters = /["<>\r\n\t]/g,
			regExpSingleCloseElements = /img|input/,
			matchReplace = function (match) {
				var retVal = "";
				if (match === '"') {
					retVal = "&quot;";
				}
				else if (match === "<") {
					retVal = "&lt;";
				}
				else if (match === ">") {
					retVal = "&gt;";
				}
				return retVal;
			},
			inputField = null;
			results = null;
			resultsHeader = null;
			statesFirefinder = {
			},
			getTabIndex = function () {
				var browsers = gBrowser.browsers,
					tabIndex;
				for (var i=0, il=browsers.length; i<il; i++) {
					if(gBrowser.getBrowserAtIndex(i).contentWindow == content) {
						tabIndex = i;
						break;
					}
				}
				return tabIndex;
			},
			getFirefinderState = function () {
				var tabIndex = this.getTabIndex(),
					state = statesFirefinder[tabIndex];
				return state;	
			};
		
		Firebug.firefinderModel = extend(Firebug.Module, {
			baseContentAdded : false,
		    showPanel : function(browser, panel) {
				var isPanel = panel && panel.name === panelName;
				var firefinderButtons = browser.chrome.$("fbfirefinderButtons");
				collapse(firefinderButtons, !isPanel);
		    },
		
			addBaseContent : function (panelNode) {
				var baseContent = domplate({
						panelBase:
						DIV({
								id : "firefinder-container"
							},
							DIV({
									id: "firefinder-base-content"
								},
								H1(
									{},
									SPAN({
										},
										"Firefinder"
									),
									SPAN({
											id : "firefinder-help-text"
										}, 
										" - Find elements matching one or several CSS expressions, or an XPath filter"
									)
								),
								DIV(
									{
										id: "firefinder-search-box"
									},
									INPUT(
										{
											class : "firefinder-field",
											type : "text",
											onkeypress : function (evt) {
												if (evt.keyCode === 13) {
													Firebug.firefinderModel.run(FirebugContext);
												}
											}
										}
									),
									INPUT(
										{
											id : "firefinder-css-button",
											type : "button",
											value : "CSS filter",
											onclick : function () {
												Firebug.firefinderModel.run(FirebugContext);
											}
										}
									),
									INPUT(
										{
											id : "firefinder-xpath-button",
											type : "button",
											value : "XPath filter",
											onclick : function () {
												Firebug.firefinderModel.run(FirebugContext, true);
											}
										}
									)
								)
							),
							DIV(
								{
									class : "firefinder-results-container initial-view"
								},
								H2({
										class : "firefinder-results-header"
									},
									"Matching elements"
								),
								DIV(
									{
										class : "firefinder-results"
									},
									"No matches"
								)
							)
						)
					});
				baseContent.panelBase.replace({}, panelNode, baseContent);
			},
		
			addStyleSheet : function (doc) {
				var styleSheet = document.getElementById("firefinder-firebug-style");
				if (!styleSheet) {
					styleSheet = createStyleSheet(doc, "chrome://firefinder/skin/firebug.css");
					styleSheet.id = "firefinder-firebug-style";
					addStyleSheet(doc, styleSheet);
				}
			},
			
		   	run : function (context, XPath) {
				var panel = context.getPanel(panelName),
					panelNode = panel.panelNode,
					collapseMatchesList = Firebug.getPref(Firebug.prefDomain, "firefinder.collapseMatchesList"),
					inputField = dLite.elmsByClass("firefinder-field", "input", panelNode)[0],
					resultsContainer = dLite.elmsByClass("firefinder-results-container", "div", panelNode)[0],
					results = dLite.elmsByClass("firefinder-results", "div", panelNode)[0],
					resultsHeader = dLite.elmsByClass("firefinder-results-header", "h2", panelNode)[0],
					firefinderResultItems,
					
					// JavaScript and CSS to add to the web browser content
					scriptApplied = content.document.getElementById("firefinder-selector"),
					head,
					script,
					css,
					
					// Parse HTML elements
					parse = function () {
						// CSS/XPath to filter by
						var filterExpression = inputField.value,
							resultItem = "",
							state = Firebug.firefinderModel.clear(context),
							matchingElements,
							
							// Sizzle reference
							sizzleDoc = content.wrappedJSObject.Sizzle;
						
						// Find matching elements
						if (XPath) {
							matchingElements = [];
							var xPathNodes = content.document.evaluate(filterExpression, content.document, ((content.document.documentElement.namespaceURI === ns.xhtml)? "xhtml:" : null), 0, null), node;
							while ((node = xPathNodes.iterateNext())) {
								matchingElements.push(node);
							}
						}
						else {
							matchingElements = sizzleDoc(filterExpression.replace(regExpSlashEscape, "\\\/"));
						}
						
						// Add class to matching elements and clone them to the results container
						if (matchingElements.length > 0) {
							for (var j=0, jl=matchingElements.length, elm, nodeNameValue, nodeNameCode, k, attr; j<jl; j++) {
								elm = matchingElements[j];
								nodeNameValue = elm.nodeName.toLowerCase();
								nodeNameCode = "<span class='node-name'>" + nodeNameValue + "</span>";
								
								resultItem += "<div class='firefinder-result-item" + ((j % 2 === 0)? " odd" : "") + "'";
								resultItem += " ref='" + j + "'>";
								resultItem += "<div class='firefinder-inspect-element'>Inspect</div>";
								resultItem += "<div class='firefinder-friendly-fire-this'>FriendlyFire</div>";
								resultItem += "&lt" + nodeNameCode;
								for (k=0, kl=elm.attributes.length; k<kl; k++) {
									attr = elm.attributes[k];
									resultItem += " " + attr.name + "=&quot;<span class='attribute-value'>" + attr.value + "</span>&quot;";
								};
								resultItem += "&gt;";
								
								if (elm.textContent.length > 0) {
								resultItem += "<div class='inner-code-container'>" + elm.textContent.replace(regExpCharacters, matchReplace) + "</div>";
								}
								if (!regExpSingleCloseElements.test(nodeNameValue)) {
									resultItem += "<div class='end-tag'>&lt;/" + nodeNameCode + "&gt;</div>";
								}
								resultItem += "</div>";
								
								elm.className += ((elm.className.length > 0)? " " : "") + "firefinder-match";
							}
						}
						else {
							resultItem = "No matches";
						}
						
						state.matchingElements = matchingElements;
						
						// Set results content
						results.innerHTML = resultItem;
						
						firefinderResultItems = dLite.elmsByClass("firefinder-result-item", "div", results);
						for (var l=0, ll=firefinderResultItems.length, matchingElm; l<ll; l++) {
							elm = firefinderResultItems[l];
							if (elm.getAttribute("ref")) {
								elm.addEventListener("mouseover", function (evt) {
									state.matchingElements[this.getAttribute("ref")].className += " firefinder-match-hover";
								}, false);
							
								elm.addEventListener("mouseout", function (evt) {
									matchingElm = state.matchingElements[this.getAttribute("ref")];
									matchingElm.className = matchingElm.className.replace(regExpHoverClass, "").replace(regExpSpaceFix, "");
								}, false);
								
								elm.addEventListener("click", function (evt) {
									var targetClassName = evt.target.className;
									if (regExpInspectElementClass.test(targetClassName)) {
										matchingElm = state.matchingElements[this.getAttribute("ref")];
										matchingElm.className = matchingElm.className.replace(regExpClass, "").replace(regExpSpaceFix, "");
										Firebug.toggleBar(true, "html");
										FirebugChrome.select(matchingElm, "html");
									}
									else if (regExpFriendlyFireURLClass.test(targetClassName)) {
										gBrowser.selectedTab = gBrowser.addTab(evt.target.textContent);
									}
									else if (regExpFriendlyFireCopyURLClass.test(targetClassName)) {
										// Copy to clipboard code taken from/inspired by https://developer.mozilla.org/en/Using_the_Clipboard
										var friendlyFireURL = evt.target.getAttribute("url"),
											textUnicode = friendlyFireURL,
											textHtml = ("<a href=\"" + friendlyFireURL + "\">" + friendlyFireURL + "</a>"),
											str = Components.classes["@mozilla.org/supports-string;1"].												                       createInstance(Components.interfaces.nsISupportsString);  
										if (!str) {
											alert("Copying failed");
											return false;
										}
										str.data = textUnicode;

										var htmlstring = Components.classes["@mozilla.org/supports-string;1"].												                       createInstance(Components.interfaces.nsISupportsString);  
										if (!htmlstring) {
											alert("Copying failed");
											return false;
										}
										htmlstring.data = textHtml;
										
										var trans = Components.classes["@mozilla.org/widget/transferable;1"].createInstance(Components.interfaces.nsITransferable);  
										if (!trans) {
											alert("Copying failed");
											return false;
										}

										trans.addDataFlavor("text/unicode");  
										trans.setTransferData("text/unicode", str, textUnicode.length * 2); // *2 because it's unicode  

										trans.addDataFlavor("text/html");  
										trans.setTransferData("text/html", htmlstring, textHtml.length * 2); // *2 because it's unicode   

										var clipboard = Components.classes["@mozilla.org/widget/clipboard;1"].												                       getService(Components.interfaces.nsIClipboard);  
										if (!clipboard) {
											alert("Copying failed");
											return false;
										}

										clipboard.setData(trans, null, Components.interfaces.nsIClipboard.kGlobalClipboard);  
										return true;
									}
									else if (regExpFriendlyFireClass.test(targetClassName)) {
										matchingElm = state.matchingElements[this.getAttribute("ref")];
										var matchingElmInList = evt.target,
											nodeName = matchingElm.nodeName.toLowerCase(),
											nodeCode = '<',
											nodeAttributes = "";
										for (m=0, ml=matchingElm.attributes.length; m<ml; m++) {
											attr = matchingElm.attributes[m];
											nodeAttributes += " " + attr.name + '="' + attr.value + '"';
										};	
										nodeCode += nodeName + nodeAttributes + '>' + matchingElm.innerHTML + '</' + nodeName + '>';
									
										var XMLHttp = new XMLHttpRequest(),
											failedText = "Failed. Click to try again",
											requestTimer;
										XMLHttp.open("POST", "http://jsbin.com/save", true);

										// These two are vital
										XMLHttp.setRequestHeader("X-Requested-With", "XMLHttpRequest");
										XMLHttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");

										// This line doesn't seem to matter, although it should state number of sent params below in the send method
										XMLHttp.setRequestHeader("Content-length", 2);

										// This line seems superfluous
										XMLHttp.setRequestHeader("Connection", "close");

										XMLHttp.onreadystatechange = function () {
											if (XMLHttp.readyState === 4) {
												clearTimeout(requestTimer);
												if (XMLHttp.status === 200) {
													var response = XMLHttp.responseText + "/edit#html";
													matchingElmInList.className += " firefinder-friendly-fire-fired";
													matchingElmInList.innerHTML = '<span class="firefinder-friendly-fire-url">' + response + '</span>(<span class="firefinder-friendly-fire-copy-url" url="' + response + '">Copy</span>)';
												}
												else {
													matchingElmInList.innerHTML = failedText;
												}
											}
										};
										XMLHttp.onerror = function () {
											matchingElmInList.innerHTML = failedText;
										};
										matchingElmInList.innerHTML = "Sending...";
										XMLHttp.send("html=" + encodeURIComponent(nodeCode.replace(regExpClass, "").replace(regExpSpaceFix, "")) + "&format=plain");
										clearTimeout(requestTimer);
										requestTimer = setTimeout(function () {
											XMLHttp.abort();
											matchingElmInList.innerHTML = "Timed out. Click to try again";
										}, 3000);
									}
									else if (!regExpInnerCodeClass.test(evt.target.className)) {
										if (regExpCollapsedClass.test(this.className)) {
											this.className = this.className.replace(regExpCollapsedClass, "").replace(regExpSpaceFix, "");
										}
										else {
											this.className += " collapsed";
										}
									}
								}, false);
							}
							if (collapseMatchesList) {
								elm.className += " collapsed";
							}	
						}
						resultsHeader.innerHTML = "Matching elements: " + matchingElements.length;
						resultsContainer.className = resultsContainer.className.replace(regExpInitialViewClass, "").replace(regExpSpaceFix, "");
					};
															
					if (!scriptApplied) {
						head = content.document.getElementsByTagName("head")[0];
						
						script = content.document.createElement("script").wrappedJSObject;
						script.id = "firefinder-selector";
						script.src = "chrome://firefinder/content/sizzle.js";
						script.type = "text/javascript";
						script.onload = parse;
						head.appendChild(script);

						css = content.document.createElement("link").wrappedJSObject;
						css.type = "text/css";
						css.rel = "stylesheet";
						css.href = "chrome://firefinder/content/browser.css";
						head.appendChild(css);
					}
					else {
						parse();
					}
		    },
		
			show : function (context) {
				// Forces Firebug to be shown, even if it's off
				Firebug.toggleBar(true);
				Firebug.toggleBar(true, panelName);
				if (FirebugContext) {
					var panel = FirebugContext.getPanel(panelName);
					var inputField = dLite.elmsByClass("firefinder-field", "input", panel.panelNode)[0];
					inputField.select();
					inputField.focus();
				}	
			},
		
			hide : function (context) {
				Firebug.toggleBar(false, panelName);
		    },
		
			clear : function (context) {
				var panel = context.getPanel(panelName),
					panelNode = panel.panelNode,
					state = getFirefinderState(),
					resultsContainer = dLite.elmsByClass("firefinder-results-container", "div", panelNode)[0],
					matchingElements;
					
				resultsContainer.className = "firefinder-results-container initial-view";	
					
				if (!state) {
					state = statesFirefinder[getTabIndex()] = {
						matchingElements : []
					};
				}
				matchingElements = state.matchingElements;
				
				// Clear previosuly matched elements' CSS classes	
				for (var i=0, il=matchingElements.length, elm; i<il; i++) {
					elm = matchingElements[i];
					elm.className = elm.className.replace(regExpClass, "").replace(regExpSpaceFix, "");
					if (elm.className.length === 0) {
						elm.removeAttribute("class");
					}
				}				
				return state;		
			}
		});
			
		
		function firefinderPanel () {
			
		}
		firefinderPanel.prototype = extend(Firebug.Panel, {
			name : panelName,
			title : "Firefinder",
			initialize : function () {
				Firebug.Panel.initialize.apply(this, arguments);
				Firebug.firefinderModel.addStyleSheet(this.document);
				Firebug.firefinderModel.addBaseContent(this.panelNode);
			},
			
			getOptionsMenuItems : function () {
				return [
					this.optionsMenuItem("Collapse matching results", "firefinder.collapseMatchesList")
				];
			},
			
			optionsMenuItem : function  (text, option) {
				var pref = Firebug.getPref(Firebug.prefDomain, option);
				return {
					label : text,
					type : "checkbox",
					checked : pref,
					command : bindFixed(Firebug.setPref, this, Firebug.prefDomain, option, !pref)
				};
			}
		});
		
		Firebug.registerModule(Firebug.firefinderModel);
		Firebug.registerPanel(firefinderPanel);
	}
});
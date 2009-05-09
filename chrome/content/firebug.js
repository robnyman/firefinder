/*global FBL */
FBL.ns(function () {
	with (FBL) {
		var panelName = "firefinder",
			regExpClass = /firefinder\-match/,
			regExpHoverClass = /firefinder\-match\-hover/,
			regExpSpaceFix = /^\s+|\s+$/g,
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
			states = {
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
			getState = function () {
				var tabIndex = this.getTabIndex(),
					state = states[tabIndex];
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
											id : "firefinder-field",
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
									id : "firefinder-results-container"
								},
								H2({
										id : "firefinder-results-header"
									},
									"Matching elements"
								),
								DIV(
									{
										id : "firefinder-results"
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
					findInlineEvents = Firebug.getPref(Firebug.prefDomain, "firefinder.inlineEvents"),
					inputField = Sizzle("#firefinder-field", panelNode)[0],
					results = Sizzle("#firefinder-results", panelNode)[0],
					resultsHeader = Sizzle("#firefinder-results-header", panelNode)[0],
					
					// JavaScript and CSS to add to the web browser content
					scriptApplied = content.document.getElementById("element-finder-selector"),
					head,
					script,
					css,
					
					// Parse HTML elements
					parse = function () {
						// CSS/XPath to filter by
						var filterExpression = inputField.value,
							resultItem = "",
							state = getState(),
							matchingElements,
							
							// Sizzle reference
							sizzle = content.wrappedJSObject.Sizzle;
						
						if (!state) {
							state = states[getTabIndex()] = {
								matchingElements : []
							};
						}
						matchingElements = state.matchingElements;						
						
						// Clear previosuly matched elements' CSS classes	
						for (var i=0, il=matchingElements.length, elm; i<il; i++) {
							elm = matchingElements[i];
							elm.className = elm.className.replace(regExpClass, "").replace(regExpSpaceFix, "");
						}
						
						// Find matching elements
						if (XPath) {
							matchingElements = [];
							var xPathNodes = content.document.evaluate(filterExpression, content.document, ((content.document.documentElement.namespaceURI === ns.xhtml)? "xhtml:" : null), 0, null), node;
							while ((node = xPathNodes.iterateNext())) {
								matchingElements.push(node);
							}
						}
						else {
							matchingElements = sizzle(filterExpression.replace(regExpSlashEscape, "\\\/"));
						}
						
						// Add class to matching elements and clone them to the results container
						if (matchingElements.length > 0) {
							for (var j=0, jl=matchingElements.length, elm, nodeNameValue, nodeNameCode, k, attr; j<jl; j++) {
								elm = matchingElements[j];
								nodeNameValue = elm.nodeName.toLowerCase();
								nodeNameCode = "<span class='node-name'>" + nodeNameValue + "</span>";
								
								resultItem += "<div class='firefinder-result-item" + ((j % 2 === 0)? " odd" : "") + "'";
								resultItem += " ref=" + j + ">";
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
									resultItem += "&lt;/" + nodeNameCode + "&gt;";
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
						
						var divs = results.getElementsByTagName("div");
						for (var l=0, ll=divs.length, matchingElm; l<ll; l++) {
							elm = divs[l];
							if (elm.getAttribute("ref")) {
								elm.addEventListener("mouseover",  function () {
									state.matchingElements[this.getAttribute("ref")].className += " firefinder-match-hover";
								}, false);
							
								elm.addEventListener("mouseout",  function () {
									matchingElm = state.matchingElements[this.getAttribute("ref")];
									matchingElm.className = matchingElm.className.replace(regExpHoverClass, "").replace(regExpSpaceFix, "");
								}, false);
							}	
						}
						resultsHeader.innerHTML = "Matching elements: " + matchingElements.length;
					};
										
					if (!scriptApplied) {
						head = content.document.getElementsByTagName("head")[0];
						
						script = content.document.createElement("script").wrappedJSObject;
						script.id = "element-finder-selector";
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
				var panel = context.getPanel(panelName);
				Firebug.toggleBar(true, panelName);
				var inputField = Sizzle("#firefinder-field", panel.panelNode)[0];
				inputField.focus();
				inputField.select();
			},
		
			hide : function (context) {
				Firebug.toggleBar(false, panelName);
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
					this.optionsMenuItem("Autorun", "firefinder.autorun"),
					this.optionsMenuItem("Inline JavaScript Events", "firefinder.inlineEvents"),
					this.optionsMenuItem("Inline Style", "firefinder.inlineStyle"),
					this.optionsMenuItem("javascript: links", "firefinder.javascriptLinks"),
					this.optionsMenuItem("Highlight all events", "firefinder.highlightAllEvents")
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
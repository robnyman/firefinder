/*global FBL */
FBL.ns(function () {
	with (FBL) {
		var panelName = "firefinder",
			regExpIsXPath = /^\//,
			regExpClass = /\s?firefinder\-match(\-hover)?/g,
			regExpHoverClass = /firefinder\-match\-hover/,
			regExpInitialViewClass = /initial\-view/,
			regExpCollapsedClass = /collapsed/,
			regExpInspectElementClass = /firefinder\-inspect\-element/,
			regExpSpaceFix = /^\s+|\s+$/g,
			regExpEmptyClass = /\sclass=(""|'')/g,
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
			inputField = null,
			results = null,
			resultsHeader = null,
			statesFirefinder = {
			},
			strBundle = document.getElementById("firefinderstrings"),
			translations = {
				firefinderfindmatchingelements : strBundle.getString("firefinderfindmatchingelements"),
				firefindermatchingelements : strBundle.getString("firefindermatchingelements"),
				firefindernomatches : strBundle.getString("firefindernomatches"),
				firefinderfilter : strBundle.getString("firefinderfilter"),
				firefindersending : strBundle.getString("firefindersending"),
				firefindertimedout : strBundle.getString("firefindertimedout"),
				firefindercopy : strBundle.getString("firefindercopy"),
				firefinderinspect : strBundle.getString("firefinderinspect"),
				firefindercollapsematcheslist : strBundle.getString("firefindercollapsematcheslist"),
				firefinderstartautoselect : strBundle.getString("firefinderstartautoselect"),
			},  
			getTabIndex = function () {
				var browsers = FBL.getTabBrowser().browsers,
					tabIndex;
				for (var i=0, il=browsers.length; i<il; i++) {
					if(FBL.getTabBrowser().getBrowserAtIndex(i).contentWindow == content) {
						tabIndex = i;
						break;
					}
				}
				return tabIndex;
			},
			getFirefinderState = function () {
			    var tabIndex = getTabIndex(),
			        state = statesFirefinder[tabIndex],
			        matchingElementsExists = false;


			    try {
			        matchingElementsExists = state.matchingElements.length + "";
			    } catch(e) {}

			    if (!state || !matchingElementsExists) {
			        state = statesFirefinder[tabIndex] = {
			            matchingElements : []
			        };
			    }   

			    return state;   
			};

		
		Firebug.firefinderModel = extend(Firebug.Module, {
			baseContentAdded : false,
		    showPanel : function(browser, panel) {
				var isPanel = panel && panel.name === panelName, 
					firefinderButtons = Firebug.chrome.$("fbfirefinderButtons"),
					state = getFirefinderState(),
					startAutoSelect = Firebug.getPref(Firebug.prefDomain, "firefinder.startAutoSelect"),
					firefinderAutoSelectButton = document.getElementById("firefinderAutoSelectButton");
				collapse(firefinderButtons, !isPanel);
				if (isPanel) {
					if (startAutoSelect) {
						Firebug.firefinderModel.autoSelect(Firebug.currentContext, true);
					}
					if (firefinderAutoSelectButton) {
						firefinderAutoSelectButton.checked = (startAutoSelect || state.autoSelect)? true : false;
					}
				}
				else {
					Firebug.firefinderModel.turnOffAutoSelect(true);
				}
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
										" - " + translations.firefinderfindmatchingelements
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
													Firebug.firefinderModel.run(Firebug.currentContext);
												}
											}
										}
									),
									INPUT(
										{
											id : "firefinder-css-button",
											type : "button",
											value : translations.firefinderfilter,
											onclick : function () {
												Firebug.firefinderModel.run(Firebug.currentContext);
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
									translations.firefindermatchingelements
								),
								DIV(
									{
										class : "firefinder-results"
									},
									translations.nomatches
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
			
		   	run : function (context, element) {
				var panel = context.getPanel(panelName),
					panelNode = panel.panelNode,
					collapseMatchesList = Firebug.getPref(Firebug.prefDomain, "firefinder.collapseMatchesList"),
					inputField = dLite.elmsByClass("firefinder-field", "input", panelNode)[0],
					resultsContainer = dLite.elmsByClass("firefinder-results-container", "div", panelNode)[0],
					results = dLite.elmsByClass("firefinder-results", "div", panelNode)[0],
					resultsHeader = dLite.elmsByClass("firefinder-results-header", "h2", panelNode)[0],
					firefinderResultItems,

					// JavaScript and CSS to add to the web browser content
					currentDocument = Firebug.currentContext.window.document,
					cssApplied = currentDocument.getElementById("firefinder-css"),
					head,
					script,
					css,
					
					// Parse HTML elements
					parse = function () {
						// CSS/XPath to filter by
						var filterExpression = inputField.value,
							XPath = regExpIsXPath.test(filterExpression),
							resultItem = "",
							state = Firebug.firefinderModel.clear(context),
							matchingElements;
						
						// Find matching elements
						if (typeof element !== "undefined") {
							matchingElements = [element];
						}
						else if (XPath) {
							matchingElements = [];
							var xPathNodes = currentDocument.evaluate(filterExpression, currentDocument, ((currentDocument.documentElement.namespaceURI === ns.xhtml)? "xhtml:" : null), 0, null), node;
							while ((node = xPathNodes.iterateNext())) {
								matchingElements.push(node);
							}
						}
						else {
							matchingElements = new XPCNativeWrapper(Firebug.currentContext.window).document.querySelectorAll(filterExpression.replace(regExpSlashEscape, "\\\/"));
						}

						// Clear results content
						results.innerHTML = "";
						
						// Add class to matching elements and clone them to the results container
						if (matchingElements.length > 0) {
							for (var j=0, jl=matchingElements.length, elm, nodeNameValue, nodeNameCode, k, kl, attr; j<jl; j++) {
								elm = matchingElements[j];
								nodeNameValue = elm.nodeName.toLowerCase();
								nodeNameCode = "<span class='node-name'>" + nodeNameValue + "</span>";

								// Each element match container
								var firefinderElement = document.createElement("div");
								firefinderElement.className = "firefinder-result-item" + ((j % 2 === 0)? " odd" : "");
								firefinderElement.ref = j;

								// Inspect element link
								var firefinderInspectElement = document.createElement("div");
								firefinderInspectElement.className = "firefinder-inspect-element";
								var firefinderInspectElementText = document.createTextNode(translations.firefinderinspect);
								firefinderInspectElement.appendChild(firefinderInspectElementText);
								firefinderElement.appendChild(firefinderInspectElement)

								// Element match display

								// Initial bracket
								var initialBracket = document.createTextNode("<");
								firefinderElement.appendChild(initialBracket);

								// Node name presentation
								var nodeNameFormat = document.createElement("span");
								nodeNameFormat.className = "node-name";
								var nodeNameText = document.createTextNode(nodeNameValue);
								nodeNameFormat.appendChild(nodeNameText);
								firefinderElement.appendChild(nodeNameFormat);

								// Adding attributes for each matching element								
								for (k=0, kl=elm.attributes.length; k<kl; k++) {
									attr = elm.attributes[k];

									// Attribute name + start quote
									var attributeName = document.createTextNode(" " + attr.name + "=\"");
									firefinderElement.appendChild(attributeName);

									// Attribute value
									var attributeValueElm = document.createElement("span");
									attributeValueElm.className = "attribute-value";
									var attributeValue = document.createTextNode(attr.value);
									attributeValueElm.appendChild(attributeValue);
									firefinderElement.appendChild(attributeValueElm);

									// Attribute end quote
									var attributeEnd = document.createTextNode("\"");
									firefinderElement.appendChild(attributeEnd);
								}

								// End bracket
								var endBracket = document.createTextNode(">");
								firefinderElement.appendChild(endBracket);

								if (elm.textContent.length > 0) {
									var innerCode = document.createElement("div");
									innerCode.className = "inner-code-container";
									var innerCodeContent = document.createTextNode(elm.textContent.replace(regExpCharacters, matchReplace));
									innerCode.appendChild(innerCodeContent);
									firefinderElement.appendChild(innerCode);
								}
								
								if (!regExpSingleCloseElements.test(nodeNameValue)) {
									// End container element
									var nodeNameEndFormat = document.createElement("div");
									nodeNameEndFormat.className = "end-tag";
									firefinderElement.appendChild(nodeNameEndFormat);

									// Initial end bracket
									var initialEndTagBracket = document.createTextNode("</");
									nodeNameEndFormat.appendChild(initialEndTagBracket);

									// Node name end format
									var nodeNameEndingFormat = document.createElement("span");
									nodeNameEndingFormat.className = "node-name";
									var nodeNameEndText = document.createTextNode(nodeNameValue);
									nodeNameEndingFormat.appendChild(nodeNameEndText);
									nodeNameEndFormat.appendChild(nodeNameEndingFormat);

									// Ending end bracket
									var endingEndTagBracket = document.createTextNode(">");
									nodeNameEndFormat.appendChild(endingEndTagBracket);
								}
								results.appendChild(firefinderElement);
								elm.className += ((elm.className.length > 0)? " " : "") + "firefinder-match";
							}
						}
						else {
							var noMatches = document.createTextNode(translations.firefindernomatches);
							results.appendChild(noMatches);
						}
						
						state.matchingElements = matchingElements;
						
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
										Firebug.chrome.select(matchingElm, "html");
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
						resultsHeader.innerHTML = translations.firefindermatchingelements + ": " + matchingElements.length;
						resultsContainer.className = resultsContainer.className.replace(regExpInitialViewClass, "").replace(regExpSpaceFix, "");
					};
															
					if (!cssApplied) {
						head = currentDocument.getElementsByTagName("head")[0];						
						css = new XPCNativeWrapper(Firebug.currentContext.window).document.createElement("link");
						css.id = "firefinder-css";
						css.type = "text/css";
						css.rel = "stylesheet";
						css.href = "chrome://firefinder/content/browser.css";
						head.appendChild(css);
					}
					parse();
		    },
		
			show : function (context) {
				// Forces Firebug to be shown, even if it's off
				Firebug.toggleBar(true);
				Firebug.toggleBar(true, panelName);
				if (Firebug.currentContext) {
					var panel = Firebug.currentContext.getPanel(panelName);
					var inputField = dLite.elmsByClass("firefinder-field", "input", panel.panelNode)[0];
					inputField.select();
					inputField.focus();
				}
			},
		
			hide : function (context) {
				Firebug.toggleBar(false, panelName);
		    },
		
			autoSelect : function (context, forceOn) {
				var state = getFirefinderState(),
					firefinderAutoSelectButton = document.getElementById("firefinderAutoSelectButton"),
					currentDocument = Firebug.currentContext.window.document;
				if (forceOn || !state.autoSelect) {
					state.autoSelect = true;
					currentDocument.addEventListener("mouseover", Firebug.firefinderModel.selectCurrentElm, true);
					currentDocument.addEventListener("click", Firebug.firefinderModel.selectCurrentElm, true);
					firefinderAutoSelectButton.checked = true;
				}
				else {
					Firebug.firefinderModel.turnOffAutoSelect();
					firefinderAutoSelectButton.checked = false;
				}
			},
			
			selectCurrentElm : function (evt) {
				Firebug.firefinderModel.run(Firebug.currentContext, evt.target);
				if (evt.type === "click") {
					evt.preventDefault();
					Firebug.firefinderModel.turnOffAutoSelect(true);
				}
			},
			
			turnOffAutoSelect : function (keepSelectedElm) {
				var state = getFirefinderState(),
					currentDocument = Firebug.currentContext.window.document;
				state.autoSelect = false;
				currentDocument.removeEventListener("mouseover", Firebug.firefinderModel.selectCurrentElm, true);
				currentDocument.removeEventListener("click", Firebug.firefinderModel.selectCurrentElm, true);
				document.getElementById("firefinderAutoSelectButton").checked = false;
				if (!keepSelectedElm) {
					Firebug.firefinderModel.clear(Firebug.currentContext);
				}
			},
		
			clear : function (context) {
				var panel = Firebug.currentContext.getPanel(panelName),
					panelNode = panel.panelNode,
					state = getFirefinderState(),
					resultsContainer = dLite.elmsByClass("firefinder-results-container", "div", panelNode)[0],
					matchingElements;
					
				resultsContainer.className = "firefinder-results-container initial-view";
				matchingElements = state.matchingElements;
				
				// Clear previosuly matched elements' CSS classes	
				for (var i=0, il=matchingElements.length, elm; i<il; i++) {
					elm = matchingElements[i];
					try {
						elm.className = elm.className.replace(regExpClass, "").replace(regExpSpaceFix, "");
						if (elm.className.length === 0) {
							elm.removeAttribute("class");
						}
					} catch(e) {}
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
					this.optionsMenuItem(translations.firefindercollapsematcheslist, "firefinder.collapseMatchesList"),
					this.optionsMenuItem(translations.firefinderstartautoselect, "firefinder.startAutoSelect"),
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

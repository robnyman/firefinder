/*global FBL */
FBL.ns(function () {
	with (FBL) {
		var panelName = "elementfinder",
			regExpClass = /elementfinder\-match/,
			regExpSpaceFix = /^\s+|\s+$/g,
			baseContentAdded = false,
			inputField = null;
			results = null;
			resultsHeader = null;
			matchingElements = [];
		
		Firebug.elementfinderModel = extend(Firebug.Module, {
		    showPanel : function(browser, panel) {
				var isPanel = panel && panel.name === panelName;
				var elementfinderButtons = browser.chrome.$("fbelementfinderButtons");
				collapse(elementfinderButtons, !isPanel);
				if (!baseContentAdded) {
					this.addBaseContent(panel);
				}
		    },
		
			addBaseContent : function (panel) {
				var parentNode = panel.panelNode,
					baseContent = domplate({
						panelBase:
						DIV({
								id : "elementfinder-container"
							},
							DIV({
									id: "elementfinder-base-content"
								},
								H1(
									{},
									SPAN({
										},
										"Element Finder"
									),
									SPAN({
											id : "elementfinder-help-text"
										}, 
										" - Find elements matching one or several CSS expressions, or an XPath filter"
									)
								),
								DIV(
									{
										id: "elementfinder-search-box"
									},
									INPUT(
										{
											id : "elementfinder-field",
											type : "text",
											onkeypress : function (evt) {
												if (evt.keyCode === 13) {
													Firebug.elementfinderModel.run(FirebugContext);
												}
											}
										}
									),
									INPUT(
										{
											id : "elementfinder-css-button",
											type : "button",
											value : "CSS filter",
											onclick : function () {
												Firebug.elementfinderModel.run(FirebugContext);
											}
										}
									),
									INPUT(
										{
											id : "elementfinder-xpath-button",
											type : "button",
											value : "XPath filter",
											onclick : function () {
												Firebug.elementfinderModel.run(FirebugContext, true);
											}
										}
									)
								)
							),
							DIV(
								{
									id : "elementfinder-results-container"
								},
								H2({
										id : "elementfinder-results-header"
									},
									"Matching elements"
								),
								DIV(
									{
										id : "elementfinder-results"
									},
									"No matches"
								)
							)
						)
					});
				
				baseContent.panelBase.replace({}, parentNode, baseContent);
				inputField = panel.document.getElementById("elementfinder-field");
				results = panel.document.getElementById("elementfinder-results");
				resultsHeader = panel.document.getElementById("elementfinder-results-header");
				baseContentAdded = true;
			},
		
			addStyleSheet : function (doc) {
				var styleSheet = document.getElementById("elementfinder-firebug-style");
				if (!styleSheet) {
					styleSheet = createStyleSheet(doc, "chrome://elementfinder/skin/elementfinder-firebug.css");
					styleSheet.id = "elementfinder-firebug-style";
					addStyleSheet(doc, styleSheet);
				}
			},

		   	run : function (context, XPath) {
				var panel = context.getPanel(panelName),
					parentNode = panel.panelNode,
					findInlineEvents = Firebug.getPref(Firebug.prefDomain, "elementfinder.inlineEvents"),
					parse = function () {
						// CSS/XPath to filter by
						var filterExpression = inputField.value,
							resultItem
						
						// Sizzle reference
						sizzle = content.wrappedJSObject.Sizzle;
						
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
							matchingElements = sizzle(filterExpression);
						}
						
						// Clear previous matches from the results container
						results.innerHTML = "";
						
						// Add class to matching elements and clone them to the results container
						if (matchingElements.length > 0) {
							for (var j=0, jl=matchingElements.length, elm; j<jl; j++) {
								elm = matchingElements[j];
								resultItem = document.createElement("div");
								resultItem.className = "elementfinder-result-item" + ((j % 2 === 0)? " odd" : "");
								resultItem.innerHTML = j + ".";
								elm.className += ((elm.className.length > 0)? " " : "") + "elementfinder-match";
								resultItem.appendChild(elm.cloneNode(true));
								results.appendChild(resultItem);
							}
						}
						else {
							resultItem = document.createElement("div");
							resultItem.className = "elementfinder-result-item";
							resultItem.innerHTML = "No matches";
							resultItem.appendChild(elm.cloneNode(true));
							results.appendChild(resultItem);
						}
						resultsHeader.innerHTML = "Matching elements: " + matchingElements.length;
					},
					
					// JavaScript and CSS to add to the web browser content
					scriptApplied = content.document.getElementById("element-finder-selector"),
					head,
					script,
					css;
					
					if (!scriptApplied) {
						head = content.document.getElementsByTagName("head")[0];
						
						script = content.document.createElement("script").wrappedJSObject;
						script.id = "element-finder-selector";
						script.src = "chrome://elementfinder/content/sizzle.js";
						script.type = "text/javascript";
						script.onload = parse;
						head.appendChild(script);

						css = content.document.createElement("link").wrappedJSObject;
						css.type = "text/css";
						css.rel = "stylesheet";
						css.href = "chrome://elementfinder/content/elementfinder-browser.css";
						head.appendChild(css);
					}
					else {
						parse();
					}
		    },
		
			show : function (context) {
				var panel = context.getPanel(panelName);
				Firebug.toggleBar(true, panelName);
				inputField.focus();
				inputField.select();
			},
		
			hide : function (context) {
				Firebug.toggleBar(false, panelName);
		    }
		});
			
		
		function elementfinderPanel () {
			
		}
		elementfinderPanel.prototype = extend(Firebug.Panel, {
			name : panelName,
			title : "Element Finder",
			initialize : function () {
				Firebug.Panel.initialize.apply(this, arguments);
				Firebug.elementfinderModel.addStyleSheet(this.document);
			},
			
			getOptionsMenuItems : function () {
				return [
					this.optionsMenuItem("Autorun", "elementfinder.autorun"),
					this.optionsMenuItem("Inline JavaScript Events", "elementfinder.inlineEvents"),
					this.optionsMenuItem("Inline Style", "elementfinder.inlineStyle"),
					this.optionsMenuItem("javascript: links", "elementfinder.javascriptLinks"),
					this.optionsMenuItem("Highlight all events", "elementfinder.highlightAllEvents")
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
		
		Firebug.registerModule(Firebug.elementfinderModel);
		Firebug.registerPanel(elementfinderPanel);
	}
});
var bidomatic = {

    active : {},

    newBidomatic : function(params) {
        var initial = bidomatic.newLoadTemplate();
        var my = {
            templates : [initial, bidomatic.newDMTemplate()],
            initialTemplateID : initial.id,
            components : [
                bidomatic.newLoadSettings({
                    category: "load.main"
                }),
                bidomatic.newTagsBrowser({
                    category: "dm.lhs"
                }),
                bidomatic.newAddForm({
                    id: "addform",
                    category: "dm.rhs"
                }),
                bidomatic.newContentViewer({
                    category: "dm.rhs"
                }),
                bidomatic.newAddButton({
                    category: "dm.control",
                    controls: "addform"
                })
            ]
        };
        params = whetstone.overlay(my, params);
        var inst = whetstone.instantiate(bidomatic.Bidomatic, params, whetstone.newApplication);
        bidomatic.active[params.selector] = inst;
        return inst;
    },
    Bidomatic : function(params) {

        this.currentData = whetstone.getParam(params.currentData, false);
        this.historyData = whetstone.getParam(params.historyData, false);
        this.current = whetstone.getParam(params.current, false);
        this.history = whetstone.getParam(params.history, false);

        this.filters = {};

        this.setCurrentData = function(params) {
            var data = whetstone.getParam(params.data, {});
            this.currentData = params.data;
            this._currentFromData();
        };

        this.setHistoryData = function(params) {
            var data = whetstone.getParam(params.data, {});
            this.historyData = params.data;
        };

        this._currentFromData = function() {
            this.current = [];
            for (var i = 0; i < this.currentData.length; i++) {
                var row = this.currentData[i];
                var content = row["Content"];
                var tags = row["Tags"];
                var id = row["ID"];
                var parsedTags = this._parseTags({source: tags});
                this.current.push({tags: parsedTags, content: content, id: id});
            }
        };

        this._parseTags = function(params) {
            var source = params.source;
            var parsed = [];

            var allocations = source.split("|");
            for (var i = 0; i < allocations.length; i++) {
                var allocation = allocations[i];
                var idx = allocation.lastIndexOf(":");
                var seqStr = allocation.substring(idx + 1);
                var seq = parseInt(seqStr);
                var tagPath = allocation.substring(0, idx);
                var heirarchy = tagPath.split("/");

                parsed.push({
                    "path" : tagPath,
                    "heirarchy" : heirarchy,
                    "sequence" : seq
                });
            }

            return parsed;
        };

        this.addContent = function(params) {
            var content = params.content;
            var tags = params.tags;
            var parsedTags = this._parseTags({source: tags});
            this.current.push({
                tags: parsedTags,
                content: content,
                id: whetstone.uuid4()
            });
            this.cycle();
        };

        this.addFilters = function(params) {
            var tag = params.tag;
            this.filters["tag"] = tag;
            this.cycle();
        };

        this.init();
    },

    /////////////////////////////////////////////////////////
    // Loading page

    newLoadTemplate : function(params) {
        var my = {
            id : "loadtemplate"
        };
        params = whetstone.overlay(my, params);
        return whetstone.instantiate(bidomatic.LoadTemplate, params, whetstone.newTemplate);
    },
    LoadTemplate : function(params) {
        this.namespace = "bidomatic_loadtemplate";

        this.draw = function() {
            var containerClass = whetstone.css_classes(this.namespace, "container");
            var componentClass = whetstone.css_classes(this.namespace, "component");

            var frag = '<div class="content"><div class="' + containerClass + '"><div class="row"><div class="col-md-12">{{COMPONENTS}}</div></div></div></div>';

            var compFrag = "";
            var components = this.application.category("load.main");
            for (var i = 0; i < components.length; i++) {
                compFrag += '<div class="' + componentClass + '"><div id="' + components[i].id + '"></div></div>';
            }

            frag = frag.replace(/{{COMPONENTS}}/g, compFrag);
            this.application.context.html(frag);
        };

        this.caresAbout = function(component) {
            return component.category.substring(0, 5) === "load.";
        }
    },

    newLoadSettings : function(params) {
        var my = {
            renderer : bidomatic.newLoadSettingsRend()
        };
        var may = {
            id : "loadsettings"
        };
        params = whetstone.overlay(my, params, may);
        return whetstone.instantiate(bidomatic.LoadSettings, params, whetstone.newComponent);
    },
    LoadSettings : function(params) {
        this.loadFiles = function(params) {
            var tasks = [];
            tasks.push({
                type: "current",
                file: params.current
            });
            tasks.push({
                type: "history",
                file: params.history
            });

            var that = this;
            var pg = whetstone.newAsyncGroup({
                list: tasks,
                action: function(params) {
                    var entry = params.entry;
                    var success = params.success_callback;
                    var error = params.error_callback;

                    Papa.parse(entry.file, {
                        header: true,
                        dynamicTyping: true,
                        complete: function(results) {
                            success(results);
                        }
                    });
                },
                successCallbackArgs: ["results"],
                success: function(params) {
                    var results = params.results;
                    var entry = params.entry;
                    var data = results.data;
                    if (entry.type === "current") {
                        that.application.setCurrentData({data : data});
                    } else if (entry.type === "history") {
                        that.application.setHistoryData({data : data});
                    }
                },
                errorCallbackArgs : ["results"],
                error:  function(params) {},
                carryOn: function() {
                    that.application.synchronise();
                    that.application.switchTemplate({id : "dmtemplate"});
                }
            });

            pg.process();
        };
    },

    newLoadSettingsRend : function(params) {
        return whetstone.instantiate(bidomatic.LoadSettingsRend, params, whetstone.newRenderer)
    },
    LoadSettingsRend : function(params) {
        this.namespace = "bidomatic_loadsettings";

        this.draw = function() {
            var currentId = whetstone.css_id(this.namespace, "current", this);
            var historyId = whetstone.css_id(this.namespace, "history", this);
            var buttonId = whetstone.css_id(this.namespace, "button", this);

            var currentFrag = '<div class="form-group"><div class="input-group">Current Data: <input type="file" name="' + currentId + '" id="' + currentId + '"></div></div>';
            var historyFrag = '<div class="form-group"><div class="input-group">History File: <input type="file" name="' + historyId + '" id="' + historyId + '"></div></div>';
            var button = '<button class="btn btn-success" type="submit" id="' + buttonId + '">Get Bidding!</button>';

            var frag = currentFrag + "<br>" + historyFrag + "<br>" + button;

            this.component.context.html(frag);
            
            var buttonSelector = whetstone.css_id_selector(this.namespace, "button", this);
            whetstone.on(buttonSelector, "click", this, "filesSelected");
        };

        this.filesSelected = function(element) {
            var currentSelector = whetstone.css_id_selector(this.namespace, "current", this);
            var historySelector = whetstone.css_id_selector(this.namespace, "history", this);

            var currentFile = this.component.jq(currentSelector)[0].files[0];
            var historyFile = this.component.jq(historySelector)[0].files[0];

            this.component.loadFiles({current: currentFile, history: historyFile});
        }
    },

    //////////////////////////////////////////////////////////////////

    //////////////////////////////////////////////////////////////////
    // Main Page

    newDMTemplate : function(params) {
        var my = {
            id : "dmtemplate"
        };
        params = whetstone.overlay(my, params);
        return whetstone.instantiate(bidomatic.DMTemplate, params, whetstone.newTemplate);
    },
    DMTemplate : function(params) {
        this.namespace = "bidomatic_dmtemplate";

        this.draw = function() {
            var containerClass = whetstone.css_classes(this.namespace, "container");
            var componentClass = whetstone.css_classes(this.namespace, "component");

            var frag = '<div class="content"><div class="' + containerClass + '">\
                    <div class="row"><div class="col-md-12">{{CONTROL}}</div></div>\
                    <div class="row"><div class="col-md-3">{{LHS}}</div><div class="col-md-9">{{RHS}}</div></div></div>\
                </div>';

            var lhsFrag = "";
            var lhs = this.application.category("dm.lhs");
            for (var i = 0; i < lhs.length; i++) {
                lhsFrag += '<div class="' + componentClass + '"><div id="' + lhs[i].id + '"></div></div>';
            }

            var rhsFrag = "";
            var rhs = this.application.category("dm.rhs");
            for (var i = 0; i < rhs.length; i++) {
                rhsFrag += '<div class="' + componentClass + '"><div id="' + rhs[i].id + '"></div></div>';
            }

            var controlFrag = "";
            var control = this.application.category("dm.control");
            for (var i = 0; i < control.length; i++) {
                controlFrag += '<div class="' + componentClass + '"><div id="' + control[i].id + '"></div></div>';
            }

            frag = frag.replace(/{{LHS}}/g, lhsFrag);
            frag = frag.replace(/{{RHS}}/g, rhsFrag);
            frag = frag.replace(/{{CONTROL}}/g, controlFrag);
            this.application.context.html(frag);
        };

        this.caresAbout = function(component) {
            return component.category.substring(0, 3) === "dm.";
        }
    },

    newTagsBrowser : function(params)
    {
        var my = {
            renderer : bidomatic.newTagsBrowserRend()
        };
        var may = {
            id : "tagsbrowser"
        };
        params = whetstone.overlay(my, params, may);
        return whetstone.instantiate(bidomatic.TagsBrowser, params, whetstone.newComponent);
    },
    TagsBrowser : function(params)
    {
        this.tags = {};
        this.tagFilter = false;

        this.synchronise = function() {
            this.tags = {};
            this.tagFilter = false;

            for (var i = 0; i < this.application.current.length; i++) {
                var row = this.application.current[i];
                for (var j = 0; j < row.tags.length; j++) {
                    var tagEntry = row.tags[j];
                    var context = this.tags;
                    for (var k = 0; k < tagEntry.heirarchy.length; k++) {
                        var tagPart = tagEntry.heirarchy[k];
                        if (!(tagPart in context)) {
                            context[tagPart] = {}
                        }
                        context = context[tagPart];
                    }
                }
            }

            if (this.application.filters.hasOwnProperty("tag")) {
                this.tagFilter = this.application.filters.tag;
            }
        };

        this.addPathFilter = function(params) {
            var path = params.path;
            this.application.addFilters({tag: path});
        }
    },

    newTagsBrowserRend : function(params)
    {
        return whetstone.instantiate(bidomatic.TagsBrowserRend, params, whetstone.newRenderer)
    },
    TagsBrowserRend : function(params)
    {
        this.namespace = "bidomatic_tagsbrowser";

        this.draw = function() {
            var linkClass = whetstone.css_classes(this.namespace, "link", this);
            var frag = this._drawLevel({context: this.component.tags, linkClass: linkClass, path: ""});
            this.component.context.html(frag);

            var linkSelector = whetstone.css_class_selector(this.namespace, "link", this);
            whetstone.on(linkSelector, "click", this, "tagSelected");
        };

        this.tagSelected = function(element) {
            var path = $(element).attr("data-path");
            this.component.addPathFilter({path: path});
        };

        this._drawLevel = function(params) {
            var linkClass = params.linkClass;
            var path = params.path;

            var frag = "<ul>";
            var context = params.context;
            var keys = Object.keys(context);
            keys.sort();
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                var subPath = key;
                if (path !== "") {
                    subPath = path + "/" + key;
                }
                var startBold = "";
                var endBold = "";
                if (this.component.tagFilter && this.component.tagFilter === subPath) {
                    startBold = "<strong>";
                    endBold = "</strong>";
                }
                frag += "<li><a href='#' class='" + linkClass + "' data-path='" + subPath + "'>" + startBold + whetstone.escapeHtml(key) + endBold + "</a>";
                var children = context[key];
                var ckeys = Object.keys(children);
                if (ckeys.length > 0) {
                    frag += this._drawLevel({context: children, linkClass: linkClass, path: subPath});
                }
                frag += "</li>";
            }
            frag += "</ul>";
            return frag;
        }
    },

    newContentViewer : function(params) {
        var my = {
            renderer : bidomatic.newContentViewerRend()
        };
        var may = {
            id : "contentviewer"
        };
        params = whetstone.overlay(my, params, may);
        return whetstone.instantiate(bidomatic.ContentViewer, params, whetstone.newComponent);
    },
    ContentViewer : function(params) {
        this.limit = whetstone.getParam(params.limit, 10);

        this.entries = [];

        this.synchronise = function() {
            this.entries = [];

            var unsorted = [];
            var j = 0;
            for (var i = 0; i < this.application.current.length ; i++) {
                if (j > this.limit) {
                    break;
                }
                var entry = this.application.current[i];
                if (this._filter(entry)) {
                    unsorted.push(entry);
                }
                j++;
            }

            if (!this.application.filters.hasOwnProperty("tag")) {
                this.entries = unsorted;
                return;
            }

            var sortMap = {};
            for (var i = 0; i < unsorted.length; i++) {
                var entry = unsorted[i];
                var sortTag = this._sortingTag(entry);
                if (!(sortTag in sortMap)) {
                    sortMap[sortTag] = [];
                }
                sortMap[sortTag].push(i);
            }
            var sortTags = Object.keys(sortMap);
            sortTags.sort();
            for (var i = 0; i < sortTags.length; i++) {
                var ids = sortMap[sortTags[i]];
                for (var j = 0; j < ids.length; j++) {
                    this.entries.push(unsorted[ids[j]]);
                }
            }
        };

        this._filter = function(entry) {
            if (!this.application.filters.hasOwnProperty("tag")) {
                return true;
            }
            var tagFilter = this.application.filters.tag;
            for (var i = 0 ; i < entry.tags.length; i++) {
                var tag = entry.tags[i];
                if (whetstone.startswith(tag.path, tagFilter)) {
                    return true;
                }
            }
            return false;
        };

        this._sortingTag = function(entry) {
            var possibles = [];
            var tagFilter = false;
            if (this.application.filters.hasOwnProperty("tag")) {
                tagFilter = this.application.filters.tag;
            }
            for (var i = 0 ; i < entry.tags.length; i++) {
                var tag = entry.tags[i];
                if (tagFilter)
                {
                    if (tag.path === tagFilter && tag.hasOwnProperty("sequence")) {
                        possibles.push(tag.path + parseInt(tag.sequence));
                    } else if (whetstone.startswith(tag.path, tagFilter)) {
                        possibles.push(tag.path);
                    }
                } else {
                    if (tag.hasOwnProperty("sequence")) {
                        possibles.push(tag.path + parseInt(tag.sequence));
                    } else {
                        possibles.push(tag.path);
                    }
                }
            }
            if (possibles.length > 0) {
                possibles.sort();
                return possibles[0];
            }
            return "";
        }
    },

    newContentViewerRend : function(params) {
        return whetstone.instantiate(bidomatic.ContentViewerRend, params, whetstone.newRenderer);
    },
    ContentViewerRend : function(params) {
        this.namespace = "bidomatic_contentviewer";

        this.draw = function() {
            var entryClass = whetstone.css_classes(this.namespace, "component", this);

            var frag = "";
            for (var i = 0; i < this.component.entries.length; i++) {
                var entry = this.component.entries[i];
                var content = whetstone.escapeHtml(entry["content"]);
                frag += '<div class="' + entryClass + '">' + content + "</div>";
            }
            this.component.context.html(frag);
        };
    },


    newAddButton : function(params) {
        var my = {
            renderer : bidomatic.newAddButtonRend()
        };
        var may = {
            id : "addbutton"
        };
        params = whetstone.overlay(my, params, may);
        return whetstone.instantiate(bidomatic.AddButton, params, whetstone.newComponent);
    },
    AddButton : function(params) {
        this.controls = whetstone.getParam(params.controls, "addform");

        this.toggleAddForm = function() {
            var comp = this.application.getComponent({id: this.controls});
            comp.toggleVisible();
            comp.draw();
        }
    },

    newAddButtonRend : function(params) {
        return whetstone.instantiate(bidomatic.AddButtonRend, params, whetstone.newRenderer);
    },
    AddButtonRend : function(params) {
        this.namespace = "bidomatic_addbutton";

        this.draw = function() {
            var componentClass = whetstone.css_classes(this.namespace, "component", this);
            var buttonId = whetstone.css_id(this.namespace, "add", this);

            var frag = '<div class="' + componentClass + '"><button type="button" id="' + buttonId + '" class="alert alert-success">+ Add</button></div>';
            this.component.context.html(frag);

            var buttonSelector = whetstone.css_id_selector(this.namespace, "add", this);
            whetstone.on(buttonSelector, "click", this, "addClicked");
        };

        this.addClicked = function(element) {
            this.component.toggleAddForm();
        }
    },


    newAddForm : function(params) {
        var my = {
            renderer : bidomatic.newAddFormRend()
        };
        var may = {
            id : "addform"
        };
        params = whetstone.overlay(my, params, may);
        return whetstone.instantiate(bidomatic.AddForm, params, whetstone.newComponent);
    },
    AddForm : function(params) {
        this.visible = whetstone.getParam(params.visible, false);

        this.toggleVisible = function() {
            this.visible = !this.visible;
        };

        this.addContent = function(params) {
            this.application.addContent(params);
        };
    },

    newAddFormRend : function(params) {
        return whetstone.instantiate(bidomatic.AddFormRend, params, whetstone.newRenderer);
    },
    AddFormRend : function(params) {
        this.namespace = "bidomatic_addform";

        this.draw = function() {
            if (!this.component.visible) {
                this.component.context.html("");
                return;
            }

            var componentClass = whetstone.css_classes(this.namespace, "component", this);
            var textareaId = whetstone.css_id(this.namespace, "content", this);
            var tagsId = whetstone.css_id(this.namespace, "tags", this);
            var buttonId = whetstone.css_id(this.namespace, "add", this);

            var frag = '<div class="' + componentClass + '">\
                    <textarea name="' + textareaId + '" id="' + textareaId + '" placeholder="content" style="width:100%"></textarea>\
                    <textarea name="' + tagsId + '" id="' + tagsId + '" placeholder="tags (X/Y:seq|Z:seq)" style="width: 100%"></textarea>\
                    <button type="button" id="' + buttonId + '" class="alert alert-success">Add</button>\
                </div>';
            this.component.context.html(frag);

            var buttonSelector = whetstone.css_id_selector(this.namespace, "add", this);
            whetstone.on(buttonSelector, "click", this, "addClicked");
        };

        this.addClicked = function(element) {
            var contentSelector = whetstone.css_id_selector(this.namespace, "content", this);
            var tagsSelector = whetstone.css_id_selector(this.namespace, "tags", this);
            var content = this.component.jq(contentSelector).val();
            var tags = this.component.jq(tagsSelector).val();
            this.component.addContent({content: content, tags: tags});
        };
    }


};

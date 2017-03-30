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
                }),
                bidomatic.newSaveButton({
                    category: "dm.control"
                })
            ]
        };
        params = whetstone.overlay(my, params);
        var inst = whetstone.instantiate(bidomatic.Bidomatic, params, whetstone.newApplication);
        bidomatic.active[params.selector] = inst;
        return inst;
    },
    Bidomatic : function(params) {

        this.currentData = whetstone.getParam(params.currentData, {});
        this.historyData = whetstone.getParam(params.historyData, false);
        this.current = whetstone.getParam(params.current, []);
        this.history = whetstone.getParam(params.history, false);

        this.filters = {};

        this.tagOrder = [];
        this.tagMap = {};

        this.setCurrentData = function(params) {
            var data = whetstone.getParam(params.data, {});
            this.currentData = params.data;
            this._currentFromData();
        };

        this.getCurrentCSV = function() {
            var raw = [];
            for (var i = 0; i < this.current.length; i++) {
                var row = this.current[i];
                var obj = {};
                obj["Content"] = row.content;
                obj["ID"] = row.id;
                obj["Tags"] = this._serialiseTags({tags: row.tags});
                raw.push(obj);
            }
            return Papa.unparse(raw);
        };

        this.iterEntries = function() {
            var idx = 0;
            var that = this;

            return {
                hasNext : function() {
                    return idx < that.current.length;
                },
                next: function() {
                    return that.current[idx++];
                }
            };
        };

        this.getEntry = function(params) {
            var id = params.id;
            for (var i = 0; i < this.current.length; i++) {
                var entry = this.current[i];
                if (entry.id === id) {
                    return entry;
                }
            }
            return false;
        };

        this.setHistoryData = function(params) {
            var data = whetstone.getParam(params.data, {});
            this.historyData = params.data;
        };

        this._currentFromData = function() {
            this.current = [];

            // first convert the data into the usable internal format
            for (var i = 0; i < this.currentData.length; i++) {
                var row = this.currentData[i];
                var content = row["Content"];
                var tags = row["Tags"];
                var id = row["ID"];
                var parsedTags = this._parseTags({source: tags});
                this.current.push({tags: parsedTags, content: content, id: id});
            }

            // create the sort order
            for (var i = 0; i < this.current.length; i++) {
                var row = this.current[i];
                for (var j = 0; j < row.tags.length; j++) {
                    var tag = row.tags[j];
                    this.tagOrder.push(tag.sort);
                    if (!(tag.sort in this.tagMap)) {
                        this.tagMap[tag.sort] = [];
                    }
                    this.tagMap[tag.sort].push(row.id);
                }
            }

            this.tagOrder.sort();
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

                var obj = {
                    "path" : tagPath,
                    "heirarchy" : heirarchy,
                    "sequence" : seq
                };
                obj["sort"] = this._sortingTag(obj);
                parsed.push(obj);
            }

            return parsed;
        };

        this._serialiseTags = function(params) {
            var tags = params.tags;
            var parts = [];
            for (var i = 0; i < tags.length; i++) {
                var tag = tags[i];
                parts.push(tag.path + ":" + String(tag.sequence));
            }
            return parts.join("|");
        };

        this._sortingTag = function(tagEntry) {
            if (tagEntry.hasOwnProperty("sequence")) {
                return tagEntry.path + String(tagEntry.sequence);
            } else {
                return tagEntry.path;
            }
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
        this.loadFileset = function(params) {
            var files = params.files;

            var bidfile = false;
            for (var i = 0; i < files.length; i++) {
                if (files[i].name === "bid.json") {
                    bidfile = files[i];
                }
            }

            if (!bidfile) {
                throw "No bid.json in directory";
            }

            var fr = new FileReader();
            var that = this;
            fr.onload = function(e) {
                var cont = e.target.result;
                var bid = JSON.parse(cont);

                var currentFile = false;
                var historyFile = false;
                for (var i = 0; i < files.length; i++) {
                    if (files[i].name === bid.current) {
                        currentFile = files[i];
                    } else if (files[i].name === bid.history) {
                        historyFile = files[i];
                    }
                }

                that.loadFiles({current: currentFile, history: historyFile});
            };
            var cont = fr.readAsText(bidfile, "utf-8");
        };

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
            /*
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
            */
            var dirId = whetstone.css_id(this.namespace, "dir", this);
            var buttonId = whetstone.css_id(this.namespace, "button", this);

            var currentFrag = '<div class="form-group"><div class="input-group">Bid Directory: <input type="file" name="' + dirId + '" id="' + dirId + '" webkitdirectory mozdirectory></div></div>';
            var button = '<button class="btn btn-success" type="submit" id="' + buttonId + '">Get Bidding!</button>';

            var frag = currentFrag + "<br>" + button;

            this.component.context.html(frag);

            var buttonSelector = whetstone.css_id_selector(this.namespace, "button", this);
            whetstone.on(buttonSelector, "click", this, "dirSelected");
        };

        this.filesSelected = function(element) {
            var currentSelector = whetstone.css_id_selector(this.namespace, "current", this);
            var historySelector = whetstone.css_id_selector(this.namespace, "history", this);

            var currentFile = this.component.jq(currentSelector)[0].files[0];
            var historyFile = this.component.jq(historySelector)[0].files[0];

            this.component.loadFiles({current: currentFile, history: historyFile});
        };

        this.dirSelected = function(element) {
            var fileSelector = whetstone.css_id_selector(this.namespace, "dir", this);
            var files = this.component.jq(fileSelector)[0].files;

            this.component.loadFileset({files: files});
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

            var controlFrag = '<div class="row">';
            var control = this.application.category("dm.control");
            for (var i = 0; i < control.length; i++) {
                controlFrag += '<div class="col-md-1"><div class="' + componentClass + '"><div id="' + control[i].id + '"></div></div></div>';
            }
            controlFrag += "</div>";

            frag = frag.replace(/{{LHS}}/g, lhsFrag);
            frag = frag.replace(/{{RHS}}/g, rhsFrag);
            frag = frag.replace(/{{CONTROL}}/g, controlFrag);
            this.application.context.html(frag);
        };

        this.caresAbout = function(component) {
            return component.category.substring(0, 3) === "dm.";
        }
    },

    newTagsBrowser : function(params) {
        var my = {
            renderer : bidomatic.newTagsBrowserRend()
        };
        var may = {
            id : "tagsbrowser"
        };
        params = whetstone.overlay(my, params, may);
        return whetstone.instantiate(bidomatic.TagsBrowser, params, whetstone.newComponent);
    },
    TagsBrowser : function(params) {
        this.tags = {};
        this.tagFilter = false;

        this.synchronise = function() {
            this.tags = {};
            this.tagFilter = false;

            var iter = this.application.iterEntries();
            while (iter.hasNext())
            {
                var row = iter.next();
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

    newTagsBrowserRend : function(params) {
        return whetstone.instantiate(bidomatic.TagsBrowserRend, params, whetstone.newRenderer)
    },
    TagsBrowserRend : function(params) {
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

            for (var i = 0; i < this.application.tagOrder.length ; i++) {
                if (this.entries.length > this.limit) {
                    break;
                }
                var tag = this.application.tagOrder[i];
                if (!this._filter(tag)) {
                    continue;
                }
                var entry_ids = this.application.tagMap[tag];
                for (var j = 0; j < entry_ids.length; j++) {
                    var id = entry_ids[j];
                    var entry = this.application.getEntry({id: id});
                    this.entries.push(entry);
                }
            }
        };

        this._filter = function(sortTag) {
            if (!this.application.filters.hasOwnProperty("tag")) {
                return true;
            }
            var tagFilter = this.application.filters.tag;
            return whetstone.startswith(sortTag, tagFilter);
        };
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

    newSaveButton : function(params) {
        var my = {
            renderer : bidomatic.newSaveButtonRend()
        };
        var may = {
            id : "savebutton"
        };
        params = whetstone.overlay(my, params, may);
        return whetstone.instantiate(bidomatic.SaveButton, params, whetstone.newComponent);
    },
    SaveButton : function(params) {
        this.save = function() {
            var csv = this.application.getCurrentCSV();
            whetstone.download({
                content: csv,
                filename: "current.csv",
                mimetype: "text/plain"
            })
        }
    },

    newSaveButtonRend : function(params) {
        return whetstone.instantiate(bidomatic.SaveButtonRend, params, whetstone.newRenderer);
    },
    SaveButtonRend : function(params) {
        this.namespace = "bidomatic_savebutton";

        this.draw = function() {
            var componentClass = whetstone.css_classes(this.namespace, "component", this);
            var buttonId = whetstone.css_id(this.namespace, "save", this);

            var frag = '<div class="' + componentClass + '"><button type="button" id="' + buttonId + '" class="alert alert-info">Save</button></div>';
            this.component.context.html(frag);

            var buttonSelector = whetstone.css_id_selector(this.namespace, "save", this);
            whetstone.on(buttonSelector, "click", this, "saveClicked");
        };

        this.saveClicked = function(element) {
            this.component.save();
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

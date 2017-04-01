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
                bidomatic.newAddEditForm({
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
                }),
                bidomatic.newBidInfo({
                    category: "dm.info"
                })
            ]
        };
        params = whetstone.overlay(my, params);
        var inst = whetstone.instantiate(bidomatic.Bidomatic, params, whetstone.newApplication);
        bidomatic.active[params.selector] = inst;
        return inst;
    },
    Bidomatic : function(params) {

        this.historyData = whetstone.getParam(params.historyData, false);

        this.current = whetstone.getParam(params.current, []);
        this.history = whetstone.getParam(params.history, false);

        this.bidFile = whetstone.getParam(params.bidFile, {});

        this.filters = {};

        this.tagOrder = [];
        this.tagMap = {};

        this.addEntry = function(params) {
            var content = params.content;
            var id = params.id;
            var tags = params.tagstring;

            var index = whetstone.getParam(params.index, true);
            var cycle = whetstone.getParam(params.cycle, true);

            var parsedTags = this._parseTags({source: tags});
            if (!id) {
                id = whetstone.uuid4();
            }
            this.current.push({tags: parsedTags, content: content, id: id, tagstring: tags});

            if (index) {
                this.index();
            }
            if (cycle) {
                this.cycle();
            }
        };

        this.updateEntry = function(params) {
            var content = params.content;
            var id = params.id;
            var tags = params.tagstring;

            var index = whetstone.getParam(params.index, true);
            var cycle = whetstone.getParam(params.cycle, true);

            var parsedTags = this._parseTags({source: tags});
            var entry = this.getEntry({id: id});

            entry.tags = parsedTags;
            entry.content = content;
            entry.tagstring = tags;

            if (index) {
                this.index();
            }
            if (cycle) {
                this.cycle();
            }
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

        this.setHistoryData = function(params) {
            var data = whetstone.getParam(params.data, {});
            this.historyData = params.data;
        };

        this.addFilters = function(params) {
            this.filters["tag"] = params.tag;
            this.cycle();
        };

        this.clearFilters = function(params) {
            var filters = params.filters;
            for (var i = 0; i < filters.length; i++) {
                var filterType = filters[i];
                if (filterType in this.filters) {
                    delete this.filters[filterType];
                }
            }
            this.cycle();
        };

        this.index = function() {
            this.tagMap = {};
            this.tagOrder = [];

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
                    "raw" : allocation,
                    "path" : tagPath,
                    "heirarchy" : heirarchy,
                    "sequence" : seq
                };
                obj["sort"] = this._sortingTag(obj);
                parsed.push(obj);
            }

            return parsed;
        };

        this._sortingTag = function(tagEntry) {
            if (tagEntry.hasOwnProperty("sequence")) {
                return tagEntry.path + String(tagEntry.sequence);
            } else {
                return tagEntry.path;
            }
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

            var frag = '<div class="container"><div class="' + containerClass + '"><div class="row"><div class="col-md-12">{{COMPONENTS}}</div></div></div></div>';

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

                that.loadFiles({current: currentFile, history: historyFile, bidFile: bid});
            };
            var cont = fr.readAsText(bidfile, "utf-8");
        };

        this.loadFiles = function(params) {
            this.application.bidFile = params.bidFile;

            var tasks = [];
            if (params.current) {
                tasks.push({
                    type: "current",
                    file: params.current
                });
            }
            if (params.history) {
                tasks.push({
                    type: "history",
                    file: params.history
                });
            }

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
                        for (var i = 0; i < data.length; i++) {
                            var row = data[i];
                            var content = row["Content"];
                            var tags = row["Tags"];
                            var id = String(row["ID"]);
                            that.application.addEntry({tagstring: tags, content: content, id: id, index: false, cycle: false});
                        }
                    } else if (entry.type === "history") {
                        that.application.setHistoryData({data : data});
                    }
                },
                errorCallbackArgs : ["results"],
                error:  function(params) {},
                carryOn: function() {
                    that.application.index();
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
            var dirId = whetstone.css_id(this.namespace, "dir", this);
            var buttonId = whetstone.css_id(this.namespace, "button", this);

            var currentFrag = '<div class="form-group"><div class="input-group">Bid Directory: <input type="file" name="' + dirId + '" id="' + dirId + '" webkitdirectory mozdirectory></div></div>';
            var button = '<button class="btn btn-success" type="submit" id="' + buttonId + '">Get Bidding!</button>';

            var frag = currentFrag + "<br>" + button;

            this.component.context.html(frag);

            var buttonSelector = whetstone.css_id_selector(this.namespace, "button", this);
            whetstone.on(buttonSelector, "click", this, "dirSelected");
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

            var frag = '<div class="container"><div class="' + containerClass + '">\
                    <div class="row"><div class="col-md-6">{{CONTROL}}</div><div class="col-md-6">{{INFO}}</div></div>\
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
                controlFrag += '<div class="col-md-3"><div class="' + componentClass + '"><div id="' + control[i].id + '"></div></div></div>';
            }
            controlFrag += "</div>";

            var infoFrag = "";
            var info = this.application.category("dm.info");
            for (var i = 0; i < info.length; i++) {
                infoFrag += '<div class="' + componentClass + '"><div id="' + info[i].id + '"></div></div>';
            }

            frag = frag.replace(/{{LHS}}/g, lhsFrag);
            frag = frag.replace(/{{RHS}}/g, rhsFrag);
            frag = frag.replace(/{{CONTROL}}/g, controlFrag);
            frag = frag.replace(/{{INFO}}/g, infoFrag);
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

        this.clearPathFilter = function() {
            this.application.clearFilters({filters: ["tag"]});
        }
    },

    newTagsBrowserRend : function(params) {
        return whetstone.instantiate(bidomatic.TagsBrowserRend, params, whetstone.newRenderer)
    },
    TagsBrowserRend : function(params) {
        this.namespace = "bidomatic_tagsbrowser";

        this.draw = function() {
            var allClass = whetstone.css_classes(this.namespace, "all", this);
            var linkClass = whetstone.css_classes(this.namespace, "link", this);

            var frag = '<a href="#" class="' + allClass + '">[show all]</a><br>';
            frag += this._drawLevel({context: this.component.tags, linkClass: linkClass, path: ""});
            this.component.context.html(frag);

            var linkSelector = whetstone.css_class_selector(this.namespace, "link", this);
            whetstone.on(linkSelector, "click", this, "tagSelected");

            var allSelector = whetstone.css_class_selector(this.namespace, "all", this);
            whetstone.on(allSelector, "click", this, "clearTags");
        };

        this.tagSelected = function(element) {
            var path = $(element).attr("data-path");
            this.component.addPathFilter({path: path});
        };

        this.clearTags = function(element) {
            this.component.clearPathFilter();
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
        this.relevantTags = [];

        this.synchronise = function() {
            this.entries = [];
            this.relevantTags = [];

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
                    this.relevantTags.push(this._getHeaderTag({entry: entry, sortTag: tag}));
                }
            }
        };

        this.getEditForm = function(params) {
            var id = params.id;
            var entry = this.application.getEntry({id : id});
            var editComponent = bidomatic.newAddEditForm({
                id: "edit_" + id,
                entry: entry,
                visible: true
            });
            editComponent.init(this.application);
            return editComponent;
        };

        this._filter = function(sortTag) {
            if (!this.application.filters.hasOwnProperty("tag")) {
                return true;
            }
            var tagFilter = this.application.filters.tag;
            return whetstone.startswith(sortTag, tagFilter);
        };

        this._getHeaderTag = function(params) {
            var entry = params.entry;
            var sortTag = params.sortTag;

            for (var i = 0; i < entry.tags.length; i++) {
                var tag = entry.tags[i];
                if (tag.sort === sortTag) {
                    return tag.path;
                }
            }
            return "";
        };
    },

    newContentViewerRend : function(params) {
        return whetstone.instantiate(bidomatic.ContentViewerRend, params, whetstone.newRenderer);
    },
    ContentViewerRend : function(params) {
        this.namespace = "bidomatic_contentviewer";
        this.markdown = new showdown.Converter();

        this.restore = "";

        this.draw = function() {
            var entryClass = whetstone.css_classes(this.namespace, "component", this);
            var tagClass = whetstone.css_classes(this.namespace, "tag", this);
            var controlsClass = whetstone.css_classes(this.namespace, "controls", this);
            var showControlsClass = whetstone.css_classes(this.namespace, "showcontrols", this);
            var topRowClass = whetstone.css_classes(this.namespace, "top", this);
            var idClass = whetstone.css_classes(this.namespace, "id", this);
            var tagsClass = whetstone.css_classes(this.namespace, "tags", this);
            var editClass = whetstone.css_classes(this.namespace, "edit", this);

            var currentTag = false;
            var frag = '<div class="row"><div class="col-md-12"><div class="' + topRowClass + '"><a href="#" class="' + showControlsClass + '">[show controls]</a></div></div></div>';
            for (var i = 0; i < this.component.entries.length; i++) {
                var entry = this.component.entries[i];
                var tag = this.component.relevantTags[i];
                if (tag !== currentTag) {
                    currentTag = tag;
                    frag += '<div class="row"><div class="col-md-12"><div class="' + tagClass + '">' + tag + '</div></div></div>';
                }
                // var content = whetstone.escapeHtml(entry["content"]);
                var content = this.markdown.makeHtml(entry["content"]);

                var entryTags = [];
                for (var j = 0; j < entry.tags.length; j++) {
                    entryTags.push(entry.tags[j].raw);
                }

                var rowId = whetstone.css_id(this.namespace, "row_" + entry.id + "_" + whetstone.safeId(currentTag), this);
                var controls = '<div class="' + controlsClass + '">\
                    <button type="button" class="' + editClass + '" data-id="' + entry.id + '" data-row="' + rowId + '">Edit</button><br>\
                    <span class="' + idClass + '">' + entry.id + '</span><br>\
                    <span class="' + tagsClass + '">' + entryTags.join(" | ") + '</span>\
                    </div>';

                frag += '<div class="row">\
                    <div class="col-md-10"><div class="' + entryClass + '" id="' + rowId + '">' + content + '</div></div>\
                    <div class="col-md-2">' + controls + '</div>\
                    </div>';
            }
            this.component.context.html(frag);

            var controlsSelector = whetstone.css_class_selector(this.namespace, "controls", this);
            this.component.jq(controlsSelector).hide();

            var showSelector = whetstone.css_class_selector(this.namespace, "showcontrols", this);
            whetstone.on(showSelector, "click", this, "toggleControls");

            var editSelector = whetstone.css_class_selector(this.namespace, "edit", this);
            whetstone.on(editSelector, "click", this, "editEntry");
        };

        this.toggleControls = function() {
            var controlsSelector = whetstone.css_class_selector(this.namespace, "controls", this);
            this.component.jq(controlsSelector).toggle();
        };

        this.editEntry = function(element) {
            var entry_id = $(element).attr("data-id");
            var rowId = $(element).attr("data-row");
            var comp = this.component.getEditForm({id: entry_id});
            var el = this.component.jq("#" + rowId);

            var that = this;
            comp.oncancel = function() {
                el.html(that.restore);
                that.enableEditButtons();
            };

            this.disableEditButtons();

            this.restore = el.html();
            el.html('<div id="' + comp.id + '"></div>');

            comp.reup();
            comp.draw();
        };

        this.disableEditButtons = function() {
            var editSelector = whetstone.css_class_selector(this.namespace, "edit", this);
            var el = this.component.jq(editSelector);
            el.attr("disabled", "disabled");
        };

        this.enableEditButtons = function() {
            var editSelector = whetstone.css_class_selector(this.namespace, "edit", this);
            var el = this.component.jq(editSelector);
            el.removeAttr("disabled");
        }
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

        this.init = function(application) {
            whetstone.up(this, "init", [application]);
            this.setupControls();
        };
        
        this.toggleAddForm = function() {
            var comp = this.application.getComponent({id: this.controls});
            comp.toggleVisible();
            comp.draw();
        };

        this.setupControls = function() {
            var comp = this.application.getComponent({id: this.controls});
            var that = this;
            comp.oncancel = function() {
                that.toggleAddForm();
            }
        };
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
            var raw = [];
            var iter = this.application.iterEntries();
            while (iter.hasNext()) {
                var row = iter.next();
                var obj = {};
                obj["Content"] = row.content;
                obj["ID"] = row.id;
                obj["Tags"] = row.tagstring;
                raw.push(obj);
            }

            var csv = Papa.unparse(raw);
            whetstone.download({
                content: csv,
                filename: "current.csv",
                mimetype: "text/plain"
            });
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

    newAddEditForm : function(params) {
        var my = {
            renderer : bidomatic.newAddEditFormRend()
        };
        var may = {
            id : "addform"
        };
        params = whetstone.overlay(my, params, may);
        return whetstone.instantiate(bidomatic.AddEditForm, params, whetstone.newComponent);
    },
    AddEditForm : function(params) {
        this.visible = whetstone.getParam(params.visible, false);
        this.entry = whetstone.getParam(params.entry, false);
        this.oncancel = whetstone.getParam(params.oncancel, false);

        this.toggleVisible = function() {
            this.visible = !this.visible;
        };

        this.addContent = function(params) {
            if (params.id) {
                this.application.updateEntry(params);
            } else {
                this.application.addEntry(params);
            }
        };

        this.cancel = function() {
            if (this.oncancel) {
                this.oncancel();
            }
        }
    },

    newAddEditFormRend : function(params) {
        return whetstone.instantiate(bidomatic.AddEditFormRend, params, whetstone.newRenderer);
    },
    AddEditFormRend : function(params) {
        this.namespace = "bidomatic_addeditform";

        this.draw = function() {
            if (!this.component.visible) {
                this.component.context.html("");
                return;
            }

            var componentClass = whetstone.css_classes(this.namespace, "component", this);
            var textareaId = whetstone.css_id(this.namespace, "content", this);
            var contentClass = whetstone.css_classes(this.namespace, "content_textarea", this);
            var tagsId = whetstone.css_id(this.namespace, "tags", this);
            var saveId = whetstone.css_id(this.namespace, "save", this);
            var cancelId = whetstone.css_id(this.namespace, "cancel", this);

            var content = "";
            var tags = "";
            var id = "";

            if (this.component.entry) {
                content = this.component.entry.content;
                tags = this.component.entry.tagstring;
                id = this.component.entry.id;
            }

            var frag = '<div class="' + componentClass + '">\
                    <textarea name="' + textareaId + '" id="' + textareaId + '" placeholder="content" style="width:100%" class="' + contentClass + '">' + content + '</textarea>\
                    <textarea name="' + tagsId + '" id="' + tagsId + '" placeholder="tags (X/Y:seq|Z:seq)" style="width: 100%">' + tags + '</textarea>\
                    <button type="button" id="' + saveId + '" class="alert alert-success" data-id="' + id + '">Save</button>\
                    <button type="button" id="' + cancelId + '" class="alert alert-danger">Cancel</button>\
                </div>';
            this.component.context.html(frag);

            if (content !== "") {
                var textareaSelector = whetstone.css_class_selector(this.namespace, "content_textarea", this);
                var el = this.component.jq(textareaSelector);
                el.height(el[0].scrollHeight);
            }

            var saveSelector = whetstone.css_id_selector(this.namespace, "save", this);
            whetstone.on(saveSelector, "click", this, "saveClicked");

            var cancelSelector = whetstone.css_id_selector(this.namespace, "cancel", this);
            whetstone.on(cancelSelector, "click", this, "cancelClicked");
        };

        this.saveClicked = function(element) {
            var id = $(element).attr("data-id");
            var contentSelector = whetstone.css_id_selector(this.namespace, "content", this);
            var tagsSelector = whetstone.css_id_selector(this.namespace, "tags", this);

            var content = this.component.jq(contentSelector).val();
            var tags = this.component.jq(tagsSelector).val();

            var obj = {content: content, tagstring: tags};
            if (id !== "") {
                obj["id"] = id;
            }
            this.component.addContent(obj);
        };

        this.cancelClicked = function(element) {
            this.component.cancel();
        }
    },

    newBidInfo : function(params) {
        var my = {
            renderer : bidomatic.newBidInfoRend()
        };
        var may = {
            id : "bidinfo"
        };
        params = whetstone.overlay(my, params, may);
        return whetstone.instantiate(bidomatic.BidInfo, params, whetstone.newComponent);
    },
    BidInfo : function(params) {
        this.name = "";

        this.synchronise = function () {
            this.name = this.application.bidFile.name;
        }
    },

    newBidInfoRend : function(params) {
        return whetstone.instantiate(bidomatic.BidInfoRend, params, whetstone.newRenderer);
    },
    BidInfoRend : function(params) {
        this.namespace = "bidomatic_bidinfo";

        this.draw = function() {
            var componentClass = whetstone.css_classes(this.namespace, "component", this);

            var frag = '<div class="' + componentClass + '">' + whetstone.escapeHtml(this.component.name) + '</div>';
            this.component.context.html(frag);
        };
    }
};
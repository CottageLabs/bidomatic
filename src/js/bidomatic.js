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
                    controls: "addform",
                    firesOnToggle: "bidomatic:resizeContentViewerScroll"
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

        this.prefixFormat = whetstone.numFormat({zeroPadding: 5});

        this.historyData = whetstone.getParam(params.historyData, false);
        this.history = whetstone.getParam(params.history, false);

        this.current = whetstone.getParam(params.current, {});

        this.bidFile = whetstone.getParam(params.bidFile, {});

        this.filters = {};

        this.tagSortOrder = [];
        this.sortMap = {};
        this.parsedTags = {};
        this.tagInfo = {};

        this.currentModified = false;

        this.actions = [];
        this.actionsMax = whetstone.getParam(params.actionsMax, 10);

        this.addEntry = function(params) {
            var content = params.content;
            var id = params.id;
            var tags = params.tagstring;

            var index = whetstone.getParam(params.index, true);
            var cycle = whetstone.getParam(params.cycle, true);
            var sequence = whetstone.getParam(params.sequence, true);
            var modified = whetstone.getParam(params.modified, true);
            var addType = whetstone.getParam(params.type, "add");

            if (!id) {
                id = whetstone.uuid4();
            }

            this.current[id] = {content: content, id: id, tagstring: tags};
            this.parsedTags[id] = this._parseTags({source: tags});
            this._setTagSequences({id: id});

            if (modified) {
                this.recordAction({entry_id: id, action: "add", type: addType, context_tag: false});
                this.currentModified = true;
            }
            if (sequence) {
                this.sequence({id: id});
            }
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
            var modified = whetstone.getParam(params.modified, true);
            var updateType = whetstone.getParam(params.type, "edit");

            var entry = this.getEntry({id: id});
            entry.content = content;
            entry.tagstring = tags;

            // parse the tags for their various usages
            this.parsedTags[id] = this._parseTags({source: tags});
            this._setTagSequences({id: id});

            if (modified) {
                this.recordAction({entry_id: id, action: "edit", type: updateType, context_tag: false});
                this.currentModified = true;
            }

            if (index) {
                this.index();
            }
            if (cycle) {
                this.cycle();
            }
        };

        this.removeEntry = function(params) {
            var id = params.id;

            var index = whetstone.getParam(params.index, true);
            var cycle = whetstone.getParam(params.cycle, true);
            var modified = whetstone.getParam(params.modified, true);
            var removeType = whetstone.getParam(params.type, "delete");

            delete this.current[id];
            delete this.parsedTags[id];

            if (modified) {
                this.recordAction({entry_id: id, action: "delete", type: removeType, context_tag: false});
                this.currentModified = true;
            }

            if (index) {
                this.index();
            }
            if (cycle) {
                this.cycle();
            }
        };

        this.getEntry = function(params) {
            var id = params.id;
            if (id in this.current) {
                var core = this.current[id];
                if (id in this.parsedTags) {
                    core.tags = this.parsedTags[id];
                }
                return core;
            }
            return false;
        };

        this.iterEntries = function(params) {
            params = whetstone.getParam(params, {});
            var filter = whetstone.getParam(params.filter, false);
            var order = whetstone.getParam(params.order, false);

            var idList = this._idList({order: order});
            var idx = 0;
            var that = this;

            return {
                _next : false,
                _seekNext : function() {
                    if (this._next != false) {
                        return;
                    }
                    while (idx < idList.ids.length) {
                        var id = idList.ids[idx];
                        var sort_context = false;
                        if (idList.sort_context.length > idx) {
                            sort_context = idList.sort_context[idx];
                        }
                        idx++;

                        if (filter) {
                            this._next = that._filter({id: id, sort_context: sort_context});
                        } else {
                            this._next = that.getEntry({id: id});
                        }

                        if (this._next != false) {
                            if (sort_context != false) {
                                this._next.context_tag = this._getHeaderTag({entry: this._next, sortTag: sort_context});
                            }
                            break;
                        }
                    }
                },
                _getHeaderTag : function(params) {
                    var entry = params.entry;
                    var sortTag = params.sortTag;

                    for (var i = 0; i < entry.tags.length; i++) {
                        var tag = entry.tags[i];
                        if (tag.sort === sortTag) {
                            return tag.path;
                        }
                    }
                    return "";
                },
                hasNext : function() {
                    this._seekNext();
                    return this._next != false;
                },
                next : function() {
                    this._seekNext();
                    if (this._next != false) {
                        var n = this._next;
                        this._next = false;
                        return n;
                    }
                    return false;
                }
            };
        };

        this.recordAction = function(params) {
            var obj = {
                entry_id : params.entry_id,
                action: params.action,
                context_tag: params.context_tag,
                type: params.type,
                datestamp: new Date()
            };
            this.actions.unshift(obj);
            if (this.actions.length > this.actionsMax) {
                this.actions.splice(this.actionsMax, this.actions.length);
            }
        };

        this.getLastAction = function() {
            if (this.actions.length > 0) {
                return this.actions[0];
            }
            return false;
        };

        this._idList = function(params) {
            var order = whetstone.getParam(params.order, false);

            var sort_context = [];
            var ids = [];
            if (order) {
                for (var i = 0; i < this.tagSortOrder.length ; i++) {
                    var tag = this.tagSortOrder[i];
                    var entry_ids = this.sortMap[tag];
                    for (var j = 0; j < entry_ids.length; j++) {
                        ids.push(entry_ids[j]);
                        sort_context.push(tag);
                    }
                }
            } else {
                ids = Object.keys(this.current);
            }

            return {ids: ids, sort_context: sort_context};
        };

        this._filter = function(params) {
            var id = params.id;
            var sort_context = params.sort_context;

            if (!this.filters.hasOwnProperty("tag")) {
                return this.getEntry({id: id});
            }

            var tagFilter = this.filters.tag;
            if (sort_context != false) {
                if (whetstone.startswith(sort_context, tagFilter)) {
                    return this.getEntry({id: id});
                } else {
                    return false;
                }
            }

            var tags = this.parsedTags[id];
            for (var i = 0; i < tags.length; i++) {
                var tag = tags[i];
                if (whetstone.startswith(tag.path, tagFilter)) {
                    return this.getEntry({id: id});
                }
            }

            return false;
        };

        this.sequence = function(params) {
            var id = params.id;
            var tags = this.parsedTags[id];

            var seqMap = {};
            for (var i = 0; i < tags.length; i++) {
                seqMap[tags[i].path] = tags[i].sequence;
            }

            var modified = false;
            var ids = Object.keys(this.parsedTags);
            for (var i = 0; i < ids.length; i++) {
                var entry_id = ids[i];
                if (id === entry_id) {
                    continue;
                }
                var pt = this.parsedTags[entry_id];
                var changed = false;
                for (var j = 0; j < pt.length; j++) {
                    var pe = pt[j];
                    if (pe.path in seqMap) {
                        var pos = seqMap[pe.path];
                        if (pos <= pe.sequence) {
                            this._incrementTag({tag: pe, by: 1});
                            changed = true;
                        }
                    }
                }
                if (changed) {
                    this.current[entry_id].tagstring = this._serialiseTags({tags: pt});
                    modified = true;
                }
            }

            if (modified) {
                this.currentModified = true;
            }
        };

        this.setNotModified = function() {
            this.currentModified = false;
            this.cycle();
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
            this.sortMap = {};
            this.tagSortOrder = [];

            // iterate through the content and index each row
            var iter = this.iterEntries();
            while (iter.hasNext()) {
                var row = iter.next();

                for (var j = 0; j < row.tags.length; j++) {
                    var tag = row.tags[j];

                    // sort out the tag ordering
                    this.tagSortOrder.push(tag.sort);
                    if (!(tag.sort in this.sortMap)) {
                        this.sortMap[tag.sort] = [];
                    }
                    this.sortMap[tag.sort].push(row.id);

                    // record the tag info
                    if (!(tag.path in this.tagInfo)) {
                        this.tagInfo[tag.path] = {};
                    }
                    if (tag.sequence > 0) {
                        var current = 0;
                        if (this.tagInfo[tag.path].hasOwnProperty("size")) {
                            current = this.tagInfo[tag.path]["size"];
                            if (tag.sequence > current) {
                                this.tagInfo[tag.path]["size"] = tag.sequence;
                            }
                        } else {
                            this.tagInfo[tag.path]["size"] = tag.sequence;
                        }
                    }
                }
            }

            this.tagSortOrder.sort();
        };

        this._parseTags = function(params) {
            var source = params.source;
            var parsed = [];

            var allocations = source.split("|");
            for (var i = 0; i < allocations.length; i++) {
                var allocation = allocations[i];
                var obj = {
                    "raw" : allocation
                };
                this._normaliseTag({tag: obj, fromRaw: true});
                parsed.push(obj);
            }

            return parsed;
        };

        this._incrementTag = function(params) {
            var tag = params.tag;
            var by = whetstone.getParam(params.by, 1);
            tag.sequence += by;
            tag.raw = tag.path + ":" + String(tag.sequence);
            delete tag.sort;
            tag.sort = this._sortingTag(tag);
        };

        this._serialiseTags = function(params) {
            var tags = params.tags;
            var ts = [];
            for (var i = 0; i < tags.length; i++) {
                ts.push(tags[i].path + ":" + String(tags[i].sequence))
            }
            return ts.join("|");
        };

        this._getUnsequencedTags = function(params) {
            var tags = params.tags;
            var unsequenced = [];
            for (var i = 0; i < tags.length; i++) {
                var tag = tags[i];
                if (tag.sequence === -1) {
                    unsequenced.push(tag);
                }
            }
            return unsequenced;
        };

        this._sortingTag = function(tagEntry) {
            if (tagEntry.hasOwnProperty("sequence")) {
                var seq = this.prefixFormat(tagEntry.sequence);
                return tagEntry.path + seq;
            } else {
                return tagEntry.path;
            }
        };

        this._normaliseTag = function(params) {
            var tag = params.tag;
            var fromRaw = whetstone.getParam(params.fromRaw, false);
            var fromPathSeq = whetstone.getParam(params.fromPathSeq, false);

            if (fromRaw) {
                var idx = tag.raw.lastIndexOf(":");
                var seq = -1;
                if (idx !== -1) {
                    var seqStr = tag.raw.substring(idx + 1);
                    seq = parseInt(seqStr);
                } else {
                    idx = tag.raw.length;
                }

                var tagPath = tag.raw.substring(0, idx);
                var hierarchy = tagPath.split("/");

                tag["path"] = tagPath;
                tag["hierarchy"] = hierarchy;
                tag["sequence"] = seq;
            } else if (fromPathSeq) {
                var hierarchy = tag.path.split("/");
                tag["raw"] = tag.path + ":" + String(tag.sequence);
                tag["hierarchy"] = hierarchy;
            }
            tag["sort"] = this._sortingTag(tag);
        };

        this._setTagSequences = function(params) {
            var id = params.id;

            var unsequenced = this._getUnsequencedTags({tags: this.parsedTags[id]});
            if (unsequenced.length > 0) {
                for (var i = 0; i < unsequenced.length; i++) {
                    var unseqtag = unsequenced[i];
                    if (unseqtag.path in this.tagInfo) {
                        var size = this.tagInfo[unseqtag.path].size;
                        if (size) {
                            unseqtag.sequence = size + 1;
                        } else {
                            unseqtag.sequence = 1;
                        }
                    } else {
                        unseqtag.sequence = 1;
                    }
                    this._normaliseTag({tag: unseqtag, fromPathSeq: true});
                }
                this.current[id].tagstring = this._serialiseTags({tags: this.parsedTags[id]});
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
                            that.application.addEntry({tagstring: tags, content: content, id: id, index: false, cycle: false, sequence: false, modified: false});
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
            var controlClass = whetstone.css_classes(this.namespace, "control");
            var controlComponentClass = whetstone.css_classes(this.namespace, "comp-cont");

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

            var controlFrag = '<div class="' + controlClass + '">';
            var control = this.application.category("dm.control");
            for (var i = 0; i < control.length; i++) {
                controlFrag += '<div class="' + controlComponentClass + '"><div id="' + control[i].id + '"></div></div>';
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
                    for (var k = 0; k < tagEntry.hierarchy.length; k++) {
                        var tagPart = tagEntry.hierarchy[k];
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
        };

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
            var selectedClass = whetstone.css_classes(this.namespace, "selected", this);
            var scrollClass = whetstone.css_classes(this.namespace, "scroll", this);

            var allSelected = "";
            if (this.component.tagFilter === false) {
                allSelected = selectedClass;
            }
            var frag = '<a href="#" class="' + allClass + ' ' + allSelected + '">[show all]</a><br>';
            frag += '<div class="' + scrollClass + '">';
            frag += this._drawLevel({context: this.component.tags, linkClass: linkClass, path: ""});
            frag += '</div>';
            this.component.context.html(frag);

            this.resizeScrollArea();
            whetstone.on(window, "resize", this, "resizeScrollArea");

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

        this.resizeScrollArea = function() {
            var scrollSelector = whetstone.css_class_selector(this.namespace, "scroll", this);
            var el = this.component.jq(scrollSelector);
            whetstone.sizeToVPBottom({jq: el, spacing: 10});
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
                var selectedClass = "";
                if (this.component.tagFilter && this.component.tagFilter === subPath) {
                    selectedClass = whetstone.css_classes(this.namespace, "selected", this);
                }
                frag += "<li><a href='#' class='" + linkClass + " " + selectedClass + "' data-path='" + subPath + "'>" + whetstone.escapeHtml(key) + "</a>";
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
        this.entries = [];
        this.lastAction = false;
        this.oldLastAction = false;

        this.synchronise = function() {
            this.entries = [];
            this.lastAction = false;

            var iter = this.application.iterEntries({filter: true, order: true});
            while (iter.hasNext()) {
                var entry = iter.next();
                this.entries.push({id : entry.id, context_tag: entry.context_tag});
            }

            var action = this.application.getLastAction();
            if (action !== false && action.datestamp !== this.oldLastAction.datestamp) {
                this.lastAction = action;
                this.oldLastAction = action;
            }
        };

        this.getEditForm = function(params) {
            params = params ? params : {};
            var id = params.id;
            var editComponent;

            if (id) {
                var entry = this.application.getEntry({id : id});
                editComponent = bidomatic.newAddEditForm({
                    id: "edit_" + id,
                    entry: entry,
                    visible: true
                });
            } else {
                editComponent = bidomatic.newAddEditForm({
                    id: "edit_" + whetstone.uuid4(),
                    visible: true
                });
            }

            editComponent.init(this.application);
            return editComponent;
        };

        this.delete = function(params) {
            var id = params.id;
            this.application.removeEntry({id : id});
        };

        this.iterEntries = function() {
            var idx = 0;
            var that = this;

            return {
                hasNext : function() {
                    return idx < that.entries.length;
                },
                next : function() {
                    var entry_ref = that.entries[idx++];
                    var entry = that.application.getEntry({id: entry_ref.id});
                    entry.context_tag = entry_ref.context_tag;
                    return entry;
                }
            }
        };
    },

    newContentViewerRend : function(params) {
        return whetstone.instantiate(bidomatic.ContentViewerRend, params, whetstone.newRenderer);
    },
    ContentViewerRend : function(params) {
        this.namespace = "bidomatic_contentviewer";
        this.markdown = new showdown.Converter();

        this.restore = "";
        this.scrollPointTag = "";

        this.draw = function() {
            this.scrollPointTag = "";

            var entryClass = whetstone.css_classes(this.namespace, "component", this);
            var tagClass = whetstone.css_classes(this.namespace, "tag", this);
            var controlsClass = whetstone.css_classes(this.namespace, "controls", this);
            var showControlsClass = whetstone.css_classes(this.namespace, "showcontrols", this);
            var topRowClass = whetstone.css_classes(this.namespace, "top", this);
            var idClass = whetstone.css_classes(this.namespace, "id", this);
            var tagsClass = whetstone.css_classes(this.namespace, "tags", this);
            var editClass = whetstone.css_classes(this.namespace, "edit", this);
            var insertClass = whetstone.css_classes(this.namespace, "insert", this);
            var deleteClass = whetstone.css_classes(this.namespace, "delete", this);
            var genericControlClass = whetstone.css_classes(this.namespace, "controller", this);
            var scrollWindow = whetstone.css_classes(this.namespace, "scroll", this);

            var currentTag = false;
            var currentSeq = 0;
            var frag = '<div class="row"><div class="col-md-12"><div class="' + topRowClass + '"><a href="#" class="' + showControlsClass + '">[hide controls]</a></div></div></div>';

            frag += '<div class="' + scrollWindow + '">';
            var iter = this.component.iterEntries();
            while (iter.hasNext()) {
                var entry = iter.next();
                var tag = entry.context_tag;
                if (tag !== currentTag) {
                    currentTag = tag;
                    frag += '<div class="row"><div class="col-md-12"><div class="' + tagClass + '">' + tag + '</div></div></div>';
                }
                for (var j = 0; j < entry.tags.length; j++) {
                    var mytag = entry.tags[j];
                    if (mytag.path == currentTag) {
                        currentSeq = mytag.sequence;
                        break;
                    }
                }
                var content = this.markdown.makeHtml(entry["content"]);

                if (this.component.lastAction !== false && entry.id === this.component.lastAction.entry_id && this.scrollPointTag === "") {
                    this.scrollPointTag = currentTag;
                }

                var entryTags = [];
                for (var j = 0; j < entry.tags.length; j++) {
                    entryTags.push(entry.tags[j].raw);
                }

                var rowId = whetstone.css_id(this.namespace, "row_" + entry.id + "_" + whetstone.safeId(currentTag), this);
                var insertId = whetstone.css_id(this.namespace, "insert_" + whetstone.uuid4(), this);
                var controls = '<div class="' + controlsClass + '">\
                    <button type="button" class="' + editClass + ' ' + genericControlClass + '" data-id="' + entry.id + '" data-row="' + rowId + '">Edit</button>\
                    <button type="button" class="' + deleteClass + ' ' + genericControlClass + '" data-id="' + entry.id + '" data-row="' + rowId + '">Delete</button><br>\
                    <span class="' + idClass + '">ID:' + entry.id + '</span><br>\
                    <span class="' + tagsClass + '">Tags:' + entryTags.join(" | ") + '</span>\
                    </div>';

                frag += '<div class="row">\
                        <div class="col-md-9"><div class="' + entryClass + '" id="' + rowId + '">' + content + '</div></div>\
                        <div class="col-md-3">' + controls + '</div>\
                    </div>\
                    <div class="' + controlsClass + '"><div class="row"><div class="col-md-12" id="' + insertId + '">\
                        <button type="button" class="' + insertClass + ' ' + genericControlClass + '" data-insert="' + insertId + '" data-tag="' + currentTag + '" data-seq="' + String(currentSeq + 1) + '">Insert Paragraph Here</button>\
                    </div></div></div>';
            }
            frag += "</div>";

            this.component.context.html(frag);

            this.resizeScrollArea();
            whetstone.on(window, "resize", this, "resizeScrollArea");
            whetstone.on(this.component.jq(), "bidomatic:resizeContentViewerScroll", this, "resizeScrollArea");

            this.setScrollPoint();

            var showSelector = whetstone.css_class_selector(this.namespace, "showcontrols", this);
            whetstone.on(showSelector, "click", this, "toggleControls");

            var editSelector = whetstone.css_class_selector(this.namespace, "edit", this);
            whetstone.on(editSelector, "click", this, "editEntry");

            var deleteSelector = whetstone.css_class_selector(this.namespace, "delete", this);
            whetstone.on(deleteSelector, "click", this, "deleteEntry");

            var insertSelector = whetstone.css_class_selector(this.namespace, "insert", this);
            whetstone.on(insertSelector, "click", this, "insertEntry");
        };

        this.toggleControls = function() {
            var controlsSelector = whetstone.css_class_selector(this.namespace, "controls", this);
            this.component.jq(controlsSelector).toggle();

            var controlLinkSelector = whetstone.css_class_selector(this.namespace, "showcontrols", this);
            var el = this.component.jq(controlLinkSelector);
            if (el.html() === "[hide controls]") {
                el.html("[show controls]");
            } else {
                el.html("[hide controls]");
            }
        };

        this.editEntry = function(element) {
            var entry_id = $(element).attr("data-id");
            var rowId = $(element).attr("data-row");
            var comp = this.component.getEditForm({id: entry_id});
            var el = this.component.jq("#" + rowId);

            var that = this;
            comp.oncancel = function() {
                el.html(that.restore);
                that.restore = "";
                that.enableEditButtons();
            };

            this.disableEditButtons();

            this.restore = el.html();
            el.html('<div id="' + comp.id + '"></div>');

            comp.draw();
        };

        this.deleteEntry = function(element) {
            var entry_id = $(element).attr("data-id");
            var sure = confirm("Are you sure you want to delete the entry with ID " + entry_id);
            if (!sure) {
                return;
            }
            this.component.delete({id: entry_id});
        };

        this.insertEntry = function(element) {
            var insertId = $(element).attr("data-insert");
            var tag = $(element).attr("data-tag");
            var seq = $(element).attr("data-seq");

            var comp = this.component.getEditForm();
            var entry = {
                tagstring: tag + ":" + seq
            };
            comp.entry = entry;
            var el = this.component.jq("#" + insertId);

            var that = this;
            comp.oncancel = function() {
                el.html(that.restore);
                that.restore = "";
                that.enableEditButtons();

                var insertSelector = whetstone.css_class_selector(that.namespace, "insert", that);
                whetstone.on(insertSelector, "click", that, "insertEntry");
            };

            comp.contextParams = {
                type: "insert"
            };

            this.disableEditButtons();

            this.restore = el.html();
            el.html('<div id="' + comp.id + '"></div>');

            comp.draw();
        };

        this.disableEditButtons = function() {
            var genericControlSelector = whetstone.css_class_selector(this.namespace, "controller", this);
            var el = this.component.jq(genericControlSelector);
            el.attr("disabled", "disabled");
        };

        this.enableEditButtons = function() {
            var genericControlSelector = whetstone.css_class_selector(this.namespace, "controller", this);
            var el = this.component.jq(genericControlSelector);
            el.removeAttr("disabled");
        };

        this.resizeScrollArea = function() {
            var scrollSelector = whetstone.css_class_selector(this.namespace, "scroll", this);
            var el = this.component.jq(scrollSelector);
            whetstone.sizeToVPBottom({jq: el, spacing: 10});
        };

        this.setScrollPoint = function() {
            var action = this.component.lastAction;
            if (!action) {
                return;
            }
            var rowIdSelector = whetstone.css_id_selector(this.namespace, "row_" + action.entry_id + "_" + whetstone.safeId(this.scrollPointTag), this);
            var row = this.component.jq(rowIdSelector);

            var scrollSelector = whetstone.css_class_selector(this.namespace, "scroll", this);
            var scrollDiv = this.component.jq(scrollSelector);

            var duration = 0;
            if (action.type === "add") {
                duration = 300;
            }

            whetstone.scrollIntoView({
                scrollParent: scrollDiv,
                scrollElement: row,
                ifNeeded: true,
                duration: duration
            })
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
        this.firesOnToggle = whetstone.getParam(params.firesOnToggle, false);

        this.init = function(application) {
            whetstone.up(this, "init", [application]);
            this.setupControls();
        };
        
        this.toggleAddForm = function() {
            var comp = this.application.getComponent({id: this.controls});
            comp.toggleVisible();
            comp.draw();
            if (this.firesOnToggle) {
                this.application.jq().trigger(this.firesOnToggle);
            }
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

            var frag = '<div class="' + componentClass + '"><button type="button" id="' + buttonId + '" class="btn btn-success">+ Add</button></div>';
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

        this.active = false;
        this.lastSaved = false;

        this.synchronise = function() {
            this.active = this.application.currentModified;
        };

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

            this.lastSaved = new Date();
            this.application.setNotModified();
        }
    },

    newSaveButtonRend : function(params) {
        return whetstone.instantiate(bidomatic.SaveButtonRend, params, whetstone.newRenderer);
    },
    SaveButtonRend : function(params) {
        this.namespace = "bidomatic_savebutton";

        this.dateFormatter = whetstone.dateFormat({format: "%H:%M on %d %b %Y (%-A ago)"});

        this.refresher = false;

        this.draw = function() {
            if (this.refresher !== false) {
                clearTimeout(this.refresher);
                this.refresher = false;
            }

            var componentClass = whetstone.css_classes(this.namespace, "component", this);
            var buttonId = whetstone.css_id(this.namespace, "save", this);

            var lastSaved = "never";
            if (this.component.lastSaved !== false) {
                lastSaved = this.dateFormatter(this.component.lastSaved);
            }

            var unsaved = "";
            var btnClasses = "";
            var btnDisabled = 'disabled="disabled"';
            if (this.component.active) {
                unsaved = "You have unsaved changes<br>";
                btnClasses = "btn-info";
                btnDisabled = "";
            }
            
            var frag = '<div class="' + componentClass + '">\
                <button type="button" id="' + buttonId + '" class="btn ' + btnClasses + '" ' + btnDisabled + '>Save</button>\
                ' + unsaved + 'last saved: ' + lastSaved + '\
                </div>';
            this.component.context.html(frag);

            var buttonSelector = whetstone.css_id_selector(this.namespace, "save", this);
            whetstone.on(buttonSelector, "click", this, "saveClicked");

            var refresh = whetstone.objClosure(this, "draw");
            this.refresher = setTimeout(refresh, 61000);
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
        this.contextParams = whetstone.getParam(params.contextParams, {});

        this.toggleVisible = function() {
            this.visible = !this.visible;
        };

        this.addContent = function(params) {
            params = whetstone.overlay(params, this.contextParams);
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
        this.markdown = new showdown.Converter();

        this.draw = function() {
            if (!this.component.visible) {
                this.component.context.html("");
                return;
            }

            var componentClass = whetstone.css_classes(this.namespace, "component", this);
            var textareaId = whetstone.css_id(this.namespace, "content", this);
            var contentClass = whetstone.css_classes(this.namespace, "content_textarea", this);
            var previewClass = whetstone.css_classes(this.namespace, "preview", this);

            var tagsId = whetstone.css_id(this.namespace, "tags", this);
            var saveId = whetstone.css_id(this.namespace, "save", this);
            var cancelId = whetstone.css_id(this.namespace, "cancel", this);
            var previewId = whetstone.css_id(this.namespace, "preview_" + this.component.entry.id, this);

            var content = "";
            var tags = "";
            var id = "";

            if (this.component.entry) {
                if (this.component.entry.content) {
                    content = this.component.entry.content;
                }
                if (this.component.entry.tagstring) {
                    tags = this.component.entry.tagstring;
                }
                if (this.component.entry.id) {
                    id = this.component.entry.id;
                }
            }

            var frag = '<div class="' + componentClass + '">\
                    <div id="' + previewId + '" class="' + previewClass + '"></div>\
                    <textarea name="' + textareaId + '" id="' + textareaId + '" placeholder="content" style="width:100%" class="' + contentClass + '">' + content + '</textarea>\
                    <textarea name="' + tagsId + '" id="' + tagsId + '" placeholder="tags (X/Y:seq|Z:seq)" style="width: 100%">' + tags + '</textarea>\
                    <button type="button" id="' + saveId + '" class="btn btn-success" data-id="' + id + '">Save</button>\
                    <button type="button" id="' + cancelId + '" class="btn btn-danger">Cancel</button>\
                </div>';
            this.component.context.html(frag);

            if (content !== "") {
                var textareaSelector = whetstone.css_class_selector(this.namespace, "content_textarea", this);
                var el = this.component.jq(textareaSelector);
                el.height(el[0].scrollHeight);
            }

            this.preview();

            var saveSelector = whetstone.css_id_selector(this.namespace, "save", this);
            whetstone.on(saveSelector, "click", this, "saveClicked");

            var cancelSelector = whetstone.css_id_selector(this.namespace, "cancel", this);
            whetstone.on(cancelSelector, "click", this, "cancelClicked");

            var contentSelector = whetstone.css_id_selector(this.namespace, "content", this);
            whetstone.on(contentSelector, "keyup", this, "preview");
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
        };

        this.preview = function(element) {
            var contentSelector = whetstone.css_id_selector(this.namespace, "content", this);
            var previewSelector = whetstone.css_id_selector(this.namespace, "preview_" + this.component.entry.id, this);

            var content = this.component.jq(contentSelector).val();
            var html = this.markdown.makeHtml(content);

            this.component.jq(previewSelector).html(html);
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
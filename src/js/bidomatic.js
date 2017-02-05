var bidomatic = {

    active : {},

    newBidomatic : function(params) {
        var initial = bidomatic.newLoadTemplate();
        var my = {
            templates : [initial],
            initialTemplateID : initial.id,
            components : [
                bidomatic.newLoadSettings({
                    category: "load.main"
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

        this.setCurrentData = function(params) {
            this.currentData = params.data;
        };

        this.setHistoryData = function(params) {
            this.historyData = params.data;
        };

        this.init();
    },

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

            var frag = '<div class="' + containerClass + '"><div class="row"><div class="col-md-12">{{COMPONENTS}}</div></div></div>';

            var compFrag = "";
            var components = this.application.category("load.main");
            for (var i = 0; i < components.length; i++) {
                compFrag += '<div class="' + componentClass + '"><div id="' + components[i].id + '"></div></div>';
            }

            frag = frag.replace(/{{COMPONENTS}}/g, compFrag);
            this.application.context.html(frag);
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
        this.loadCurrentFile = function(params) {
            var file = params.file;

            var app = this.application;
            Papa.parse(file, {
                header: true,
                dynamicTyping: true,
                complete: function(results) {
                    app.setCurrentData({data : results});
                }
            });
        };

        this.loadHistoryFile = function(params) {
            var file = params.file;

            Papa.parse(file, {
                header: true,
                dynamicTyping: true,
                complete: function(results) {
                    data = results;
                }
            });
        }
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

            this.component.loadCurrentFile({file: currentFile});
            this.component.loadHistoryFile({file: historyFile});
        }
    },

    newTextBlock : function(params) {
        return whetstone.instantiate(bidomatic.TextBlock, params, whetstone.newComponent);
    },
    TextBlock : function(params) {
        this.content = whetstone.getParam(params.content, "");
        this.id = whetstone.getParam(parans.id);
    }
};

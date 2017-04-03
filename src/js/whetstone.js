// first define the bind with delay function from (saves loading it separately)
// https://github.com/bgrins/bindWithDelay/blob/master/bindWithDelay.js
(function($) {
    $.fn.bindWithDelay = function( type, data, fn, timeout, throttle ) {
        var wait = null;
        var that = this;

        if ( $.isFunction( data ) ) {
            throttle = timeout;
            timeout = fn;
            fn = data;
            data = undefined;
        }

        function cb() {
            var e = $.extend(true, { }, arguments[0]);
            var throttler = function() {
                wait = null;
                fn.apply(that, [e]);
            };

            if (!throttle) { clearTimeout(wait); }
            if (!throttle || !wait) { wait = setTimeout(throttler, timeout); }
        }

        return this.bind(type, data, cb);
    };
})(jQuery);

var whetstone = {

    instantiate : function(clazz, params, protoConstructor) {
        if (!params) { params = {} }
        if (protoConstructor) {
            clazz.prototype = protoConstructor(params);
        }
        var inst = new clazz(params);
        if (protoConstructor) {
            inst.__proto_constructor__ = protoConstructor;
        }
        return inst;
    },
    
    up : function(inst, fn, args) {
        var parent = new inst.__proto_constructor__();
        parent[fn].apply(inst, args);
    },

    newApplication : function(params) {
        return whetstone.instantiate(whetstone.Application, params);
    },
    Application : function(params) {
        // the jquery selector for the element where the edge will be deployed
        this.selector = whetstone.getParam(params.selector, "body");

        this.templates = whetstone.getParam(params.templates, []);
        this.initialTemplateID = whetstone.getParam(params.initialTemplateID, false);
        this.currentTemplate = false;

        // list of all the components that are involved in this edge
        this.components = whetstone.getParam(params.components, []);

        // start the application.  Must be run first
        this.init = function() {
            // obtain the jquery context for all our operations
            this.context = $(this.selector);
            this.context.trigger("whetstone:pre-init");

            for (var i = 0; i < this.templates.length; i++) {
                this.templates[i].init(this);
            }

            // render the template if necessary
            if (this.templates.length > 0 && this.initialTemplateID !== false) {
                this.currentTemplate = this.getTemplate({id: this.initialTemplateID});
                this.currentTemplate.draw(this);
            }

            // call each of the relevant components to initialise themselves
            this.initComponents();

            // now call each relevant component to render itself
            this.draw();

            this.context.trigger("whetstone:post-init");

            // now cycle the app
            this.cycle();
        };

        this.initComponents = function() {
            for (var i = 0; i < this.components.length; i++) {
                var component = this.components[i];
                if (this.currentTemplate.caresAbout(component)) {
                    component.init(this);
                }
            }
        };

        this.cycle = function() {
            this.synchronise();

            // pre-render trigger
            this.context.trigger("whetstone:pre-render");
            // render
            this.draw();
            // post render trigger
            this.context.trigger("whetstone:post-render");
        };

        this.synchronise = function() {
            // ask the components to synchronise themselves with the latest state
            for (var i = 0; i < this.components.length; i++) {
                var component = this.components[i];
                if (this.currentTemplate.caresAbout(component)) {
                    component.synchronise();
                }
            }
        };

        this.draw = function() {
            for (var i = 0; i < this.components.length; i++) {
                var component = this.components[i];
                if (this.currentTemplate.caresAbout(component)) {
                    component.draw();
                }
            }
        };

        // get the jquery object for the desired element, in the correct context
        // you should ALWAYS use this, rather than the standard jquery $ object
        this.jq = function(selector) {
            return $(selector, this.context);
        };

        ////////////////////////////////////////////////
        // various utility functions

        this.getComponent = function(params) {
            var id = params.id;
            for (var i = 0; i < this.components.length; i++) {
                var component = this.components[i];
                if (component.id === id) {
                    return component;
                }
            }
            return false;
        };

        // return components in the requested category
        this.category = function(cat) {
            var comps = [];
            for (var i = 0; i < this.components.length; i++) {
                var component = this.components[i];
                if (component.category === cat) {
                    comps.push(component);
                }
            }
            return comps;
        };

        this.getTemplate = function(params) {
            var id = params.id;
            for (var i = 0; i < this.templates.length; i++) {
                var temp = this.templates[i];
                if (temp.id === id) {
                    return temp;
                }
            }
            return false;
        };
        
        this.switchTemplate = function(params) {
            var tid = params.id;
            var temp = this.getTemplate({id: tid});
            if (temp) {
                this.currentTemplate = temp;
                this.currentTemplate.draw(this);
                this.initComponents();
                this.draw();
                this.cycle();
            } else {
                throw whetstone.newWhetstoneException({
                    message: "No such template " + tid
                });
            }

        }
    },

    /////////////////////////////////////////////
    // Base classes for the various kinds of components

    newTemplate : function(params) {
        return whetstone.instantiate(whetstone.Template, params);
    },
    Template : function(params) {
        this.id = whetstone.getParam(params.id);
        this.application = whetstone.getParam(params.application);
        this.namespace = "whetstone_template";

        this.init = function(application) {
            this.application = application;
        };

        this.caresAbout = function(component) {
            return true;
        };

        this.draw = function() {}
    },

    newComponent : function(params) {
        return whetstone.instantiate(whetstone.Component, params);
    },
    Component : function(params) {
        this.id = whetstone.getParam(params.id);
        this.renderer = whetstone.getParam(params.renderer);
        this.category = whetstone.getParam(params.category, "none");

        this.init = function(application) {
            // record a reference to the parent object
            this.application = application;
            this.context = this.application.jq("#" + this.id);

            if (this.renderer) {
                this.renderer.init(this);
            }
        };

        this.reup = function() {
            this.context = this.application.jq("#" + this.id);
        };

        this.draw = function() {
            if (this.context.length === 0) {
                this.reup();
            }
            if (this.renderer) {
                this.renderer.draw();
            }
        };

        this.synchronise = function() {};

        // convenience method for any renderer rendering a component
        this.jq = function(selector) {
            return this.application.jq(selector);
        }
    },

    newRenderer : function(params) {
        return whetstone.instantiate(whetstone.Renderer, params);
    },
    Renderer : function(params) {
        this.component = whetstone.getParam(params.component);
        this.namespace = "whetstone_renderer";
        this.init = function(component) {
            this.component = component
        };
        this.draw = function() {}
    },

    newWhetstoneException : function(params) {
        return whetstone.instantiate(whetstone.WhetstoneException, params);
    },
    WhetstoneException : function(params) {
        this.message = whetstone.getParam(params.message, "");
    },

    //////////////////////////////////////////////////
    // Asynchronous batch processing feature

    newAsyncGroup : function(params) {
        return whetstone.instantiate(whetstone.AsyncGroup, params);
    },
    AsyncGroup : function(params) {
        this.list = whetstone.getParam(params.list);
        this.successCallbackArgs = whetstone.getParam(params.successCallbackArgs);
        this.errorCallbackArgs = whetstone.getParam(params.errorCallbackArgs);

        var action = params.action;
        var success = params.success;
        var carryOn = params.carryOn;
        var error = params.error;

        this.functions = {
            action: action,
            success: success,
            carryOn: carryOn,
            error: error
        };

        this.checkList = [];

        this.finished = false;

        this.construct = function(params) {
            for (var i = 0; i < this.list.length; i++) {
                this.checkList.push(0);
            }
        };

        this.process = function(params) {
            if (this.list.length == 0) {
                this.functions.carryOn();
            }

            for (var i = 0; i < this.list.length; i++) {
                var context = {index: i};

                var success_callback = whetstone.objClosure(this, "_actionSuccess", this.successCallbackArgs, context);
                var error_callback = whetstone.objClosure(this, "_actionError", this.successCallbackArgs, context);
                var complete_callback = false;

                this.functions.action({entry: this.list[i],
                    success_callback: success_callback,
                    error_callback: error_callback,
                    complete_callback: complete_callback
                });
            }
        };

        this._actionSuccess = function(params) {
            var index = params.index;
            delete params.index;

            params["entry"] = this.list[index];
            this.functions.success(params);
            this.checkList[index] = 1;

            if (this._isComplete()) {
                this._finalise();
            }
        };

        this._actionError = function(params) {
            var index = params.index;
            delete params.index;

            params["entry"] = this.list[index];
            this.functions.error(params);
            this.checkList[index] = -1;

            if (this._isComplete()) {
                this._finalise();
            }
        };

        this._actionComplete = function(params) {

        };

        this._isComplete = function() {
            return $.inArray(0, this.checkList) === -1;
        };

        this._finalise = function() {
            if (this.finished) {
                return;
            }
            this.finished = true;
            this.functions.carryOn();
        };

        ////////////////////////////////////////
        this.construct();
    },

    //////////////////////////////////////////////////
    // URL handling functions

    getUrlParams : function() {
        var params = {};
        var url = window.location.href;
        var fragment = false;

        // break the anchor off the url
        if (url.indexOf("#") > -1) {
            fragment = url.slice(url.indexOf('#'));
            url = url.substring(0, url.indexOf('#'));
        }

        // extract and split the query args
        var args = url.slice(url.indexOf('?') + 1).split('&');

        for (var i = 0; i < args.length; i++) {
            var kv = args[i].split('=');
            if (kv.length === 2) {
                var val = decodeURIComponent(kv[1]);
                if (val[0] == "[" || val[0] == "{") {
                    // if it looks like a JSON object in string form...
                    // remove " (double quotes) at beginning and end of string to make it a valid
                    // representation of a JSON object, or the parser will complain
                    val = val.replace(/^"/,"").replace(/"$/,"");
                    val = JSON.parse(val);
                }
                params[kv[0]] = val;
            }
        }

        // record the fragment identifier if required
        if (fragment) {
            params['#'] = fragment;
        }

        return params;
    },

    //////////////////////////////////////////////////////////////////
    // Closures for integrating the object with other modules

    // returns a function that will call the named function (fn) on
    // a specified object instance (obj), with all "arguments"
    // supplied to the closure by the caller
    //
    // if the args property is specified here, instead a parameters object
    // will be constructed with a one to one mapping between the names in args
    // and the values in the "arguments" supplied to the closure, until all
    // values in "args" are exhausted.
    //
    // so, for example,
    //
    // objClosure(this, "function")(arg1, arg2, arg3)
    // results in a call to
    // this.function(arg1, arg2, arg3, ...)
    //
    // and
    // objClosure(this, "function", ["one", "two"])(arg1, arg2, arg3)
    // results in a call to
    // this.function({one: arg1, two: arg2})
    //
    objClosure : function(obj, fn, args, context_params) {
        return function() {
            if (args) {
                var params = {};
                for (var i = 0; i < args.length; i++) {
                    if (arguments.length > i) {
                        params[args[i]] = arguments[i];
                    }
                }
                if (context_params) {
                    params = $.extend(params, context_params);
                }
                obj[fn](params);
            } else {
                var slice = Array.prototype.slice;
                var theArgs = slice.apply(arguments);
                if (context_params) {
                    theArgs.push(context_params);
                }
                obj[fn].apply(obj, theArgs);
            }
        }
    },

    // returns a function that is suitable for triggering by an event, and which will
    // call the specified function (fn) on the specified object (obj) with the element
    // which fired the event as the argument
    //
    // if "conditional" is specified, this is a function (which can take the event as an argument)
    // which is called to determine whether the event will propagate to the object function.
    //
    // so, for example
    //
    // eventClosure(this, "handler")(event)
    // results in a call to
    // this.handler(element)
    //
    // and
    //
    // eventClosure(this, "handler", function(event) { return event.type === "click" })(event)
    // results in a call (only in the case that the event is a click), to
    // this.handler(element)
    //
    eventClosure : function(obj, fn, conditional) {
        return function(event) {
            if (conditional) {
                if (!conditional(event)) {
                    return;
                }
            }

            event.preventDefault();
            obj[fn](this);
        }
    },

    //////////////////////////////////////////////////////////////////
    // CSS normalising/canonicalisation tools

    css_classes : function(namespace, field, renderer) {
        var cl = namespace + "-" + field;
        if (renderer) {
            cl += " " + cl + "-" + renderer.component.id;
        }
        return cl;
    },

    css_class_selector : function(namespace, field, renderer) {
        var sel = "." + namespace + "-" + field;
        if (renderer) {
            sel += sel + "-" + renderer.component.id;
        }
        return sel;
    },

    css_id : function(namespace, field, renderer) {
        var id = namespace + "-" + field;
        if (renderer) {
            id += "-" + renderer.component.id;
        }
        return id;
    },

    css_id_selector : function(namespace, field, renderer) {
        return "#" + whetstone.css_id(namespace, field, renderer);
    },

    //////////////////////////////////////////////////////////////////
    // Event binding utilities

    on : function(selector, event, caller, targetFunction, delay, conditional) {
        // if the caller has an inner component (i.e. it is a Renderer), use the component's id
        // otherwise, if it has a namespace (which is true of Renderers or Templates) use that
        if (caller.component && caller.component.id) {
            event = event + "." + caller.component.id;
        } else if (caller.namespace) {
            event = event + "." + caller.namespace;
        }

        // create the closure to be called on the event
        var clos = whetstone.eventClosure(caller, targetFunction, conditional);

        // now bind the closure directly or with delay
        // if the caller has an inner component (i.e. it is a Renderer) use the components jQuery selector
        // otherwise, if it has an inner, use the selector on that.
        if (delay) {
            if (caller.component) {
                caller.component.jq(selector).unbind(event).bindWithDelay(event, clos, delay);
            } else if (caller.application) {
                caller.application.jq(selector).unbind(event).bindWithDelay(event, clos, delay);
            } else {
                console.log("attempt to bindWithDelay on caller which has neither inner component or application")
            }
        } else {
            if (caller.component) {
                caller.component.jq(selector).unbind(event).on(event, clos);
            } else if (caller.application) {
                caller.application.jq(selector).unbind(event).on(event, clos);
            } else {
                console.log("attempt to bind on caller which has neither inner component or application")
            }
        }
    },

    //////////////////////////////////////////////////////////////////
    // Shared utilities

    escapeHtml : function(unsafe, def) {
        if (def === undefined) {
            def = "";
        }
        if (unsafe === undefined || unsafe == null) {
            return def;
        }
        try {
            if (typeof unsafe.replace !== "function") {
                return unsafe
            }
            return unsafe
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        } catch(err) {
            return def;
        }
    },

    objVal : function(path, rec, def) {
        if (def === undefined) {
            def = false;
        }
        var bits = path.split(".");
        var val = rec;
        for (var i = 0; i < bits.length; i++) {
            var field = bits[i];
            if (field in val) {
                val = val[field];
            } else {
                return def;
            }
        }
        return val;
    },

    getParam : function(value, def) {
        return value !== undefined ? value : def;
    },

    overlay : function(top, middle, bottom) {
        if (!bottom) { bottom = {} }
        if (!top) { top = {} }
        if (!middle) { middle = {} }
        var result = {};
        $.extend(result, bottom, middle, top);
        return result;
    },

    safeId : function(unsafe) {
        return unsafe.replace(/&/g, "_")
            .replace(/</g, "_")
            .replace(/>/g, "_")
            .replace(/"/g, "_")
            .replace(/'/g, "_")
            .replace(/\//g, "_")
            .replace(/\./gi,'_')
            .replace(/\:/gi,'_')
            .replace(/\s/gi,"_");
    },

    numFormat : function(params) {
        var prefix = whetstone.getParam(params.prefix, "");
        var zeroPadding = whetstone.getParam(params.zeroPadding, false);
        var decimalPlaces = whetstone.getParam(params.decimalPlaces, false);
        var thousandsSeparator = whetstone.getParam(params.thousandsSeparator, false);
        var decimalSeparator = whetstone.getParam(params.decimalSeparator, ".");
        var suffix = whetstone.getParam(params.suffix, "");

        return function(num) {
            // ensure this is really a number
            num = parseFloat(num);

            // first off we need to convert the number to a string, which we can do directly, or using toFixed if that
            // is suitable here
            if (decimalPlaces !== false) {
                num = num.toFixed(decimalPlaces);
            } else {
                num  = num.toString();
            }

            // now "num" is a string containing the formatted number that we can work on

            var bits = num.split(".");

            if (zeroPadding !== false) {
                var zeros = zeroPadding - bits[0].length;
                var pad = "";
                for (var i = 0; i < zeros; i++) {
                    pad += "0";
                }
                bits[0] = pad + bits[0];
            }

            if (thousandsSeparator !== false) {
                bits[0] = bits[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);
            }

            if (bits.length == 1) {
                return prefix + bits[0] + suffix;
            } else {
                return prefix + bits[0] + decimalSeparator + bits[1] + suffix;
            }
        }
    },

    uuid4 : function() {
        var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
        return uuid;
    },

    startswith : function(str, prefix) {
        return str.substring(0, prefix.length) === prefix;
    },

    download : function(params) {
        var content = params.content;
        var filename = params.filename;
        var mimetype = params.mimetype;

        var textFileAsBlob = new Blob([content], {type:mimetype});
        var downloadLink = document.createElement("a");
        downloadLink.download = filename;
        downloadLink.innerHTML = "Download File";
        if (window.webkitURL != null)
        {
            // Chrome allows the link to be clicked
            // without actually adding it to the DOM.
            downloadLink.href = window.webkitURL.createObjectURL(textFileAsBlob);
        }
        else
        {
            // Firefox requires the link to be added to the DOM
            // before it can be clicked.
            downloadLink.href = window.URL.createObjectURL(textFileAsBlob);
            // downloadLink.onclick = destroyClickedElement;
            // downloadLink.style.display = "none";
            document.body.appendChild(downloadLink);
        }

        downloadLink.click();
    }
};

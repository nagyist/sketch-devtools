var module = angular.module('SketchConsole', ['ui.bootstrap']);

module.controller('SketchConsoleController', function ($scope,$http,$sce,$location,$anchorScroll,$compile) {
    $scope.items = [];

    // Initialize options object.
    if(angular.isUndefined($scope.options)) {
        $scope.options=JSON.parse(SketchDevTools.getConsoleOptions());
    }

    $scope.addBrokenImportItem = function(path,filePath,line) {

        $scope.items.push({
            type: "brokenImport",
            path: path,
            filePath: filePath,
            line: line
        });
    };

    $scope.addCustomPrintItem = function(contents) {
        $scope.items.push({
            type: "custom",
            contents: contents
        });
    };

    $scope.addSessionItem = function(scriptName,duration) {
        var newItem={
            type: "session",
            name: scriptName,
            duration: duration,
            timestamp: new Date().valueOf()
        };

        $scope.items.push(newItem);
    };

    $scope.addErrorItem = function(type,message,filePath,line,errorLineContents,callStack) {

        var newItem={
            type: "error",
            error: {
                type: type,
                message: message,
                filePath: filePath,
                line: line,
                errorLineContents: errorLineContents,
                stack: JSON.parse(callStack)
            }
        };

        $scope.items.push(newItem);

    };

    $scope.addMochaErrorItem = function(contents,filePath) {

        var newItem={
            type: "mochaError",
            contents: contents,
            filePath: filePath
        };

        $scope.items.push(newItem);
    };

    $scope.addItem = function(contents,pluginName,pluginFilePath,pluginRootFolderPath) {

        var newItem={
            type: "print",
            contents: contents,
            plugin: {
                name: pluginName,
                filePath: pluginFilePath,
                rootFolderPath: pluginRootFolderPath
            }
        };

        $scope.items.push(newItem);
    };

    $scope.addItemEx = function(contents,filePath,line) {

        var newItem = {
            type: "extendedPrint",
            contents: contents,
            filePath: filePath,
            line: line,
            timestamp: new Date().valueOf()
        };

        $scope.items.push(newItem);
    };

    $scope.showLogo = function() {
        return $scope.items.length==0 && !$scope.isOptionsOpened;
    };

    $scope.timestamp = function() {
        return moment().format("ddd, hA");
    };

    $scope.clear = function() {
        $scope.items=[];
    };

    $scope.showSettings = function() {
        $scope.isOptionsOpened=true;

    };

    $scope.hideSettings = function() {
        $scope.isOptionsOpened=false;
    };

    $scope.renderHtml = function(item) {

        if(item.type=="brokenImport") {

            function buildClickProtocolHandlerStringEx() {
                return Mustache.render('SketchDevTools.openFileWithIDE("{{{file}}}","{{ide}}",{{line}})',{
                    ide: $scope.options.defaultProtocolHandler,
                    file: item.filePath,
                    line: item.line.toString()
                });
            }

            var template="<div class='col-lg-12' style='margin-bottom: 0px;'><div class='bs-callout bs-callout-danger'><h4><span class='label label-danger'>#</span> {{errorTitle}}: <span style='color: #545454;'>{{errorMessage}}</span></h4> <p><a href='#' onclick='{{click}}'>{{fileName}}, Line: {{line}}</a></p></div></div>";
            return $sce.trustAsHtml(Mustache.render(template,
                {
                    errorTitle: "Module Import Error",
                    fileName: _.last(item.filePath.split("/")),
                    errorMessage: "Could not #import '"+item.path+"'",
                    line: item.line,
                    click: buildClickProtocolHandlerStringEx()
                }));
        }

        if(item.type=="custom") {
            return $sce.trustAsHtml(Mustache.render("<div class='col-lg-12'>{{{contents}}}</div>",item));
        }

        if(item.type=="session" && $scope.options.showSessionInfo) {

            function humanizeDuration(duration) {
                if(Math.floor(duration)>0) {
                    return Math.floor(duration)+"s "+(((duration-Math.floor(duration)))*1000).toFixed()+"ms";
                }

                return (duration*1000).toFixed()+" ms";
            }

            return $sce.trustAsHtml(Mustache.render(
                "<div class='col-lg-12'><span class='text-success'>{{timestamp}}: {{name}} - Script executed in {{duration}}</span></div>",{
                    name: (item.name=="Untitled.sketchplugin") ? "Custom Script" : item.name,
                    duration: humanizeDuration(item.duration),
                    timestamp: moment(item.timestamp).format("HH:mm:ss.SSS")
                }));
        }

        if(item.type=="extendedPrint") {

            var fileName=_.last(item.filePath.split("/"));
            var isCustomScript=fileName=="Untitled.sketchplugin";

            var clickHandler=(isCustomScript) ? "SketchDevTools.showCustomScriptWindow("+item.line+")" : Mustache.render('SketchDevTools.openFileWithIDE("{{{file}}}","{{ide}}",{{line}})',{
                    ide: $scope.options.defaultProtocolHandler,
                    file: item.filePath,
                    line: item.line.toString()
                });

            var contentsHtml=Mustache.render(
                // "<div class='col-lg-11'>{{{contents}}}</div><div class='col-lg-1'><span class='pull-right text-muted'><small><a href='#' onclick='{{click}}'>{{file}}:{{line}}</a></small></span></div>",
                "<div class='col-lg-12'><div class='print-statement-content'>{{{contents}}}</div><div class='print-statement-meta'><span class='pull-right text-muted'><small><a href='#' onclick='{{click}}'>{{file}}:{{line}}</a></small></span></div></div>",
                {
                    contents: item.contents,
                    file: isCustomScript ? "Custom Script" : fileName,
                    line: item.line,
                    click: clickHandler
                });

            return $sce.trustAsHtml(contentsHtml);
        }


        if(item.type=="mochaError") {

            var fileName = _.last(item.filePath.split("/"));
            var isCustomScript = (fileName=="Untitled.sketchplugin") ? true : false;
            var template="<div class='bs-callout bs-callout-{{level}}'><h4><span class='label label-{{level}}'>{{symbol}}</span> {{errorTitle}}: </h4><p>{{errorMessage}}</p> <p><a href='#' onclick='{{click}}'>{{fileName}}</a></p></div>";

            var click= isCustomScript ? "SketchDevTools.showCustomScriptWindow(1)" :  Mustache.render('SketchDevTools.openFileWithIDE("{{{file}}}","{{ide}}",{{line}})',{
                ide: $scope.options.defaultProtocolHandler,
                file: item.filePath,
                line: 1
            });

            var errorHtml=Mustache.render(
                template,
                {
                    level: "danger",
                    symbol: "M",
                    errorTitle: "Mocha RunTime Error",
                    errorMessage: item.contents,
                    fileName: isCustomScript ? "Custom Script" : fileName,
                    click: click
                });

            return $sce.trustAsHtml(Mustache.render("<div class='col-lg-12' style='margin-bottom: 0;'>{{{error}}}</div>",{
                error: errorHtml
            }));
        }


        if(item.type=="error") {
            var error=item.error;

            var fileName=_.last(error.filePath.split("/"));
            function buildProtocolHandlerString() {
                return $scope.options.defaultProtocolHandler+":"+error.filePath+":"+error.line;
            }

            function buildClickProtocolHandlerString() {
                // return $scope.options.defaultProtocolHandler+":"+error.filePath+":"+error.line;
                return Mustache.render('SketchDevTools.openFileWithIDE("{{{file}}}","{{ide}}",{{line}})',{
                    ide: $scope.options.defaultProtocolHandler,
                    file: error.filePath,
                    line: error.line.toString()
                });
            }

            var link=Mustache.render($scope.options.protocolHandlerTemplate,{
                    filePath: error.filePath,
                    line: error.line
                });

            var protocolHandler=buildProtocolHandlerString();
            link = "#";


            var template="<div class='bs-callout bs-callout-{{level}}'><h4><span class='label label-{{level}}'>{{symbol}}</span> {{errorTitle}}: <span style='color: #545454;'>{{errorMessage}}</span></h4><p>»  {{errorLineContents}}  «</p> <p><a href='{{link}}' onclick='{{click}}' protocol_handler='{{protocolHandler}}'>{{fileName}}, Line: {{line}}</a></p>{{{callStack}}}</div>";

            // FIXME: OMG! THIS THING IS AWFUL!
            var errors={
                "JSReferenceError": {
                    level: "danger",
                    symbol: "R",
                    errorTitle: "Reference Error",
                    errorMessage: error.message,
                    fileName: fileName,
                    line: error.line,
                    link: link,
                    errorLineContents: error.errorLineContents,
                    protocolHandler: protocolHandler,
                    click: buildClickProtocolHandlerString()
                },
                "JSSyntaxError": {
                    level: "danger",
                    symbol: "S",
                    errorTitle: "Syntax Error",
                    errorMessage: error.message,
                    fileName: fileName,
                    line: error.line,
                    link: link,
                    errorLineContents: error.errorLineContents,
                    protocolHandler: protocolHandler,
                    click: buildClickProtocolHandlerString()
                },
                "JSTypeError": {
                    level: "danger",
                    symbol: "T",
                    errorTitle: "Type Error",
                    errorMessage: error.message,
                    fileName: fileName,
                    line: error.line,
                    link: link,
                    errorLineContents: error.errorLineContents,
                    protocolHandler: protocolHandler,
                    click: buildClickProtocolHandlerString()
                },
                "JSRangeError": {
                    level: "danger",
                    symbol: "R",
                    errorTitle: "Range Error",
                    errorMessage: error.message,
                    fileName: fileName,
                    line: error.line,
                    link: link,
                    errorLineContents: error.errorLineContents,
                    protocolHandler: protocolHandler,
                    click: buildClickProtocolHandlerString()
                },
                "JSCustomError": {
                    level: "danger",
                    symbol: "E",
                    errorTitle: "Error",
                    errorMessage: error.message,
                    fileName: fileName,
                    line: error.line,
                    link: link,
                    errorLineContents: error.errorLineContents,
                    protocolHandler: protocolHandler,
                    click: buildClickProtocolHandlerString()
                }
            };

            // Custom Script handler.
            var actualError=errors[error.type];
            if(actualError.fileName=="Untitled.sketchplugin") {
                actualError.fileName="Custom Script";
                actualError.link="#";
                actualError["click"]="SketchDevTools.showCustomScriptWindow("+actualError.line+")";
            } else {
                // actualError["click"]="";
            }







            // Call stack
            {

                var result="";
                _.each(error.stack,function(call) {
                    var fileName= _.last(call.filePath.split("/"));
                    var fn=(call.fn=="closure") ? "(anonymous function)" : call.fn;
                    fn =(fn=="global code") ? "(global)" : fn;

                    result+=Mustache.render("<p>{{{fn}}} - {{fileName}}:{{line}}:{{column}}</p>",{
                        fn: fn,
                        fileName: fileName,
                        line: call.line,
                        column: call.column
                    });
                })

                actualError["callStack"]=result;
            }

            var errorHtml=Mustache.render(template,actualError);
            return $sce.trustAsHtml(Mustache.render("<div class='col-lg-12' style='margin-bottom: 0px;'>{{{error}}}</div>",{
                error: errorHtml
            }));
        }

        return "<H3><span class='label label-danger'>UNKNOWN ITEM</span></H3>";
    };


    $scope.isError = function(log) {

        if($scope.isSyntaxError(log)) return true;
        if($scope.isReferenceError(log)) return true;
        if($scope.isTypeError(log)) return true;
        if($scope.isCustomError(log)) return true;

        return false;
    };

    $scope.isCustomError = function(log) {
        return log.indexOf("Error:")==0;
    };

    $scope.isSyntaxError = function(log) {
        return log.indexOf("SyntaxError:")>-1;
    };

    $scope.isReferenceError = function(log) {
        return log.indexOf("ReferenceError:")>-1;
    };

    $scope.isTypeError = function(log) {
        return log.indexOf("TypeError:")>-1;
    };

    $scope.hideConsole = function() {
        SketchDevTools.hideConsole();
    };

    $scope.getConsoleOptions = function() {
        var options=JSON.parse(SketchDevTools.getConsoleOptions());
    };

    $scope.setConsoleOptions = function() {
        var options={
            protocolHandlerTemplate: "subl://open/?url=file://{{{filePath}}}&line={{line}}",
            showConsoleOnError: false
        };

        SketchDevTools.setConsoleOptions(JSON.stringify(options,null,4));
    };


    //  Options popup.
    $scope.isOptionsOpened = false;

    $scope.editors = [
        {
            name: "Sublime Text",
            icon: "Sublime.png",
            key: "sublime"
        },
        {
            name: "TextMate",
            icon: "TextMate.png",
            key: "textmate"
        },
        {
            name: "WebStorm",
            icon: "WebStorm.png",
            key: "webstorm"
        },
        {
            name: "Atom",
            icon: "Atom.png",
            key: "atom"
        },
        {
            name: "AppCode",
            icon: "AppCode.png",
            key: "appcode"
        },
        {
            name: "Xcode",
            icon: "XCode.png",
            key: "xcode"
        },
        {
            name: "MacVim",
            icon: "MacVim.png",
            key: "macvim"
        }
    ];

    $scope.iconForEditor = function(editor) {
        return "./images/editors/"+editor.icon;
    };

    $scope.currentEditor = function()  {
        return _.find($scope.editors,function(editor) {
            return $scope.options.defaultProtocolHandler==editor.key;
        });
    };

    $scope.onEditorChange = function(editor) {
        $scope.options.defaultProtocolHandler=editor.key;
    };

    $scope.$watch('options.defaultProtocolHandler', function() {
        SketchDevTools.setConsoleOptions(JSON.stringify($scope.options,null,4));
    });

    $scope.$watch('options.showConsoleOnPrint', function() {
        SketchDevTools.setConsoleOptions(JSON.stringify($scope.options,null,4));
    });

    $scope.$watch('options.showConsoleOnError', function() {
        SketchDevTools.setConsoleOptions(JSON.stringify($scope.options,null,4));
    });

    $scope.$watch('options.clearConsoleBeforeLaunch', function() {
        SketchDevTools.setConsoleOptions(JSON.stringify($scope.options,null,4));
    });

    $scope.$watch('options.showSessionInfo', function() {
        SketchDevTools.setConsoleOptions(JSON.stringify($scope.options,null,4));
    });


    // EXPERIMENTAL STUFF
    $scope.isRed = false;
    $scope.showMeRed = function(show) {
        $scope.isRed = show;
    }
});
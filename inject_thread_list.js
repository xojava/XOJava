// My sessionStorage
var SS = {
    prepend: 'xo-',
    get: function (k) {
        var self = this;
        return $.parseJSON(window.sessionStorage.getItem(this.prepend + k));
    },
    getAllThreads: function () {
        var self = this;
        var results = {};
        for (var key in window.sessionStorage) {
            if (key.indexOf(this.prepend + "tx") > -1) {
                results[key] = JSON.parse(window.sessionStorage.getItem(key));
            }
        }
        return results;
    },
    set: function (k, v) {
        return window.sessionStorage.setItem(this.prepend + k.toString(), JSON.stringify(v));
    },
    removeThread: function (k) {
        return window.sessionStorage.removeItem(this.prepend + "tx" + k.toString());
    }
};

// My localStorage
var LS = {
    prepend: 'xo-',
    get: function (k) {
        var self = this;
        return $.parseJSON(window.localStorage.getItem(this.prepend + k));
    },
    set: function (k, v) {
        return window.localStorage.setItem(this.prepend + k.toString(), JSON.stringify(v));
    }
};



var pageThreads = {};  // list of threadIDs on the current page.  Use to control LS cache.
var XOJavaIndex = {
    
    init: function () { //Chrome Extension start method
//        XOJavaIndex.loadThread("http://xoxohth.com/thread.php?thread_id=1936687&mc=22&forum_id=2", {pc: 0,posters: {}}, '2490105');

        
        
        jQuery.each($("a"), function () {
            if (this.href.indexOf("thread_id") > -1) {
                var threadId = this.href.substring(40, this.href.indexOf("&"));
                var postCnt = this.href.substring(this.href.indexOf("&mc=")+4, this.href.indexOf("&forum"));
                pageThreads[threadId] = 1;

                if(SS.get('tx' + threadId) != undefined && SS.get('tx' + threadId).pc == postCnt) {
                    //console.log('cached$$$$ ' + threadId);
                    return;
                } else {
                    //console.log('loading! ' + threadId + ' ... ' + postCnt + '<br>');
                    var thread = {
                        pc: postCnt,
                        posters: {}
                    };
                    XOJavaIndex.loadThread(this.href, thread, threadId);
                }
            }

        });
        XOJavaIndex.displayPosters();
    },


    displayPosters: function() {
        
        var threads = SS.getAllThreads();
        var uniqPosters = {};
        var isSearch = (document.location.href.indexOf("&qu=") > -1)?1:0;
        for (var tKey in threads) {

            //evict cache for threads in local storage not on current page.  Don't evict cache on search results page.
            if(!isSearch && pageThreads[tKey.substring(5)] != 1) {
                SS.removeThread(tKey.substring(5));
                continue;
            }



            for(var poster in threads[tKey].posters) {
                if(uniqPosters[poster] != undefined) {
                    uniqPosters[poster].pc = Number(uniqPosters[poster].pc) + threads[tKey].posters[poster];
                    uniqPosters[poster].tc = Number(uniqPosters[poster].tc) + 1;
                } else {
                    uniqPosters[poster] = {};
                    uniqPosters[poster].pc = threads[tKey].posters[poster];
                    uniqPosters[poster].tc = 1;
                    uniqPosters[poster].nm = poster;
                }
            }
        }
        var xoJavaApp = angular.module('xoJavaApp', ['ngRoute', 'ngSanitize'])
        .controller('PosterListCtrl', function ($scope) {
           $scope.posterorder = 'nm';
           $scope.uniqPosters = uniqPosters;
        })
        .config(function($routeProvider, $sceProvider) {
            $sceProvider.enabled(false); //need to fix this at some point
			$routeProvider
				.when('/view1', {
                    templateUrl: chrome.extension.getURL('poster_list.html'),
					controller:  'PosterListCtrl'
					//resolve: {'phn': 'PhoneData'}

				})
                .otherwise({redirectTo: '/view1'});

		})
        .filter('array', function() {
          return function(items) {
            var filtered = [];
            angular.forEach(items, function(item) {
              filtered.push(item);
            });
           return filtered;
          };
        });        
        $('<div id="postersAng"><ng-view /></div>').prependTo("body");        
        angular.bootstrap($('#postersAng'), ['xoJavaApp']);
        $(window).resize();
    },





    loadThread: function (url, thread, threadId) {
        //console.log('LOAD THREAD AJAX URL: ' + url);

        jQuery.ajax({
            url: url,
            type: 'get',
            dataType: 'html',
            success: function (data) {
                var _html = jQuery(data);
                var dblCntr = 0;
                jQuery.each(_html.find("p"), function () {
                    var dateIndex = this.innerHTML.indexOf("<b>Date:</b>");
                    if (dateIndex > -1) {
                        if(dblCntr++ % 2 == 0) {
                            return;
                        }
                        var dt = this.innerHTML.substring(dateIndex+14, dateIndex+40);
                        //var au = this.innerHTML.substring(dateIndex+60);
                        var au = this.innerHTML.substring(this.innerHTML.indexOf('<b>Author:</b>')+14, this.innerHTML.indexOf('<br><br>'));

                        //console.log('i: ' + this.innerHTML);
                        //au = au.substring(0, au.indexOf("<br>")).replace(/^\s+/,"");
                        au = au.replace(/^\s+/,"");
                        if(au.indexOf('<i><a href="mailto') > -1) {
                            au = au.replace(/<i>.+">/,"");
                            au = au.replace(/<\/a><\/i>/,"");
                        }

                        //console.log('a:' + au);






                        if(dblCntr == 2) {//LOAD OP INFO
                            var contIdx = this.innerHTML.indexOf("<br><br>")+8;
                            var cont = this.innerHTML.substring(contIdx, contIdx+50);



                            thread['op'] = au;

                            //console.log('FP: ' + this.innerHTML.substring(contIdx) + " idx: " + cont.indexOf("<br><br><br><br><font size=1>"));




                            if(cont.indexOf("<a target") == 0) {
                                var fullCont = this.innerHTML.substring(contIdx);

                                //console.log('href: ' + fullCont);
                                //console.log('href: ' + fullCont.substring(fullCont.indexOf('">')+2, fullCont.indexOf('</a>')));
                                thread['fp'] = "Link: " + fullCont.substring(fullCont.indexOf('">')+2, fullCont.indexOf('</a>'));

                            } else if(this.innerHTML.substring(contIdx).indexOf('<br><br><font size="1">(http://www.autoadmit.com/thread.php') == 0) {
                                thread['fp'] = 'BLANK OP';
                                //console.log('blank: ');
                            } else {
                                //console.log('else: ' + cont);
                                thread['fp'] = cont;
                            }
                            //console.log('----------================');
                        }


                        //console.log('Date-> ' + dt);

                        var existing = thread.posters[au];
                        if(existing == null) {
                            thread.posters[au] = 1;
                        } else {
                            thread.posters[au] = Number( thread.posters[au]) + 1;
                        }

                        //console.log('--');
                    }
                });
                SS.set('tx' + threadId, thread);
            }
        });


    }
};


var jsInitChecktimer = setInterval(checkForJS_Finish, 111);

function checkForJS_Finish() {
    if (typeof $ != "undefined") {
        clearInterval(jsInitChecktimer);
        XOJavaIndex.init();
    }
}





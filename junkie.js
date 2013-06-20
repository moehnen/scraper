// https://code.google.com/p/crypto-js/
// http://www.pdflib.com/
var casper = require('casper').create({
    verbose: true
    //, logLevel: "info"
});

var utils = require('utils');
var cu = require('clientutils').create();//utils.mergeObjects({}, this.options));
var helpers = require('./helpers'); // http://planzero.org/blog/2013/03/07/spidering_the_web_with_casperjs
var sha = require('./sha'); // http://membres-liglab.imag.fr/donsez/cours/exemplescourstechnoweb/js_securehash/sha1src.html
var fs = require('fs'); // https://github.com/ariya/phantomjs/wiki/API-Reference-FileSystem
var f = utils.format;
var scrapeResult = {};

casper.on('error', function (msg, backtrace) {
    this.echo("=========================");
    this.echo("ERROR:");
    this.echo(msg);
    this.echo(backtrace);
    this.echo("=========================");
});

//casper.on('resource.requested', function (resource, request) {

//    casper.log("requested: " + resource['url'], "info");

//    //if ((/http:\/\/ad./gi).test(resource['url'])) {
//    //    console.log('The url of the request is matching. Aborting: ' + resource['url']);
//    //    request.abort();
//    //}
//});

casper.handleLinks = function handleLinksFunction(currentScrape, scrapeResultPages) {
    var currentPage =
    {
        level: currentScrape.level,
        title: this.getTitle(),
        url: this.getCurrentUrl()
        , scraper: currentScrape

    };
    scrapeResultPages.push(currentPage);
    this.echo(f("handleLinks: %s: %s", this.getTitle(), this.getCurrentUrl()));

    if (currentScrape.textpattern) {
        var links = this.evaluate(function (currentScrape) {
            var links = [];
            Array.prototype.forEach.call(__utils__.findAll('a'), function (e) {
                //__utils__.echo('#' + e.innerText.trim() + '#');
                var re = new RegExp(currentScrape.textpattern.replace(/\*/g, ".*"));
                if (currentScrape.textpattern && e.innerText.match(re)) {
                    var link = {
                        href: e.getAttribute('href'),
                        innerText: e.innerText.trim()
                    };
                    if (e.getAttribute('title'))
                        link.title = e.getAttribute('title');
                    var found = false;
                    for (var i = 0; i < links.length; i++) {
                        if (links[i].href == link.href && links[i].innerText == link.innerText) {
                            found = true;
                            break;
                        }
                    }

                    if (!found)
                        links.push(link);
                }
            });
            return links;
        }, currentScrape);
    } else
        if (currentScrape.pages) {
            var links = currentScrape.pages;
        } else {
            var links = [this.getCurrentUrl()];
        }

    this.echo("links: " + links.length);
    //this.echo("links: " + JSON.stringify(links, null, '\t'));
    Array.prototype.forEach.call(links, function (link) {
        var baseUrl = casper.getGlobal('location').origin;
        var newUrl = helpers.absoluteUri(baseUrl, link.href || link);
        if (!currentScrape.handle || currentScrape.handle === "parse") {
            casper.echo(f(" -parse: %s", newUrl));
            casper
                .thenOpen(newUrl)
                .then(function () {
                    if (!currentPage.pages)
                        currentPage.pages = [];
                    currentScrape.each.level = currentScrape.level + 1;
                    casper.handleLinks(currentScrape.each, currentPage.pages)
                });
        }
        if (currentScrape.handle === "capture") {
            casper.echo(f(" -capture: %s", newUrl));
            casper
                .thenOpen(newUrl)
                .then(function () {
                    if (!currentPage.pages)
                        currentPage.pages = [];
                    var base64png = casper.captureBase64('png');
                    var shapng = sha.calcSHA1(base64png);
                    var localUrl = shapng + '.png';
                    try {
                        //currentPage.pages.push(currentPage);
                        var newPage = {
                            title: currentScrape.textpattern,
                            url: newUrl,
                            sha: shapng
                        };
                        currentPage.pages.push(newPage);
                        fs.write(localUrl, cu.decode(base64png), 'wb');
                    } catch (e) {
                        this.log(f("Error while downloading %s to %s: %s", newUrl, localUrl, e), "error");
                    }
                });

        }
        if (currentScrape.handle === "download") {
            var urlParts = newUrl.split("/"),
                workAroundUrl = urlParts[0] + "//" + urlParts[2];
            casper.echo(f(" -download: %s", newUrl));
            casper
                .thenOpen(workAroundUrl)
                .then(function () {
                    if (!currentPage.pages)
                        currentPage.pages = [];
                    var base64pdf = casper.base64encode(newUrl);
                    var shapdf = sha.calcSHA1(base64pdf);
                    var localUrl = currentScrape.level + "." + currentPage.pages.length + ".pdf";// urlParts[urlParts.length - 1];
                    try {
                        //currentPage.pages.push(currentPage);
                        var newPage = {
                            title: localUrl,
                            url: newUrl,
                            sha: shapdf
                        };
                        //this.echo("push: " + localUrl);
                        currentPage.pages.push(newPage);
                        fs.write(localUrl, cu.decode(base64pdf), 'wb');
                        this.emit('downloaded.file', localUrl);
                        this.log(f("Downloaded and saved resource in %s", localUrl));
                    } catch (e) {
                        this.log(f("Error while downloading %s to %s: %s", newUrl, localUrl, e), "error");
                    }
                });
        }
    });

};

casper.loadScrape = function (name) {
    var jsonScrape = fs.read(name + "/scrape.json");
    this.echo(jsonScrape);
    var scrape = JSON.parse(jsonScrape);
    fs.changeWorkingDirectory(scrape.name);
    scrapeResult['pages'] = [];
    casper
        .then(function () {
            casper.handleLinks(scrape, scrapeResult.pages);
        })
        .then(function () {
            this.echo('========================================');
            this.echo(JSON.stringify(scrapeResult, null, '  '));
            fs.write("result.json", JSON.stringify(scrapeResult, null, '\t'), 'w');
        });
};

casper.start().then(function () {
    if (casper.cli.has(0)) {
        var name = casper.cli.get(0);
        casper.loadScrape(name);
    } else {
        var files = fs.list(".");
        Array.prototype.forEach.call(files, function (file) {
            if (fs.isDirectory(file) && fs.exists(file + "/scrape.js")) {
                casper.echo(file);
                //casper.loadScrape(file);
            }
        });
    }
});

casper.run(function () {
    this.exit();
});
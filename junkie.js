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

phantom.injectJs('include.js');

casper.handleLinks = function handleLinksFunction(currentScrape, scrapeResult) {

    this.echo("handleLinks: " + JSON.stringify(currentScrape));
    var links = [];
    if (currentScrape.textpattern) {
        links = this.evaluate(function (currentScrape) {
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
                        if (links[i].href === link.href && links[i].innerText === link.innerText) {
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
            links = currentScrape.pages;
        } else {
            links = [this.getCurrentUrl()];
        }

    this.echo("links found: " + links.length);
    //this.echo("links: " + JSON.stringify(links, null, '\t'));

    Array.prototype.forEach.call(links, function (link) {
        var baseUrl = casper.getGlobal('location').origin;
        var newUrl = helpers.absoluteUri(baseUrl, (link.href || link));
        if (!currentScrape.handle || currentScrape.handle === "parse") {
            casper.echo(f(" -parse: %s", newUrl));
            casper
                .thenOpen(newUrl)
                .then(function () {
                    if (!scrapeResult.pages)
                        scrapeResult.pages = [];
                    var level = currentScrape.level + "." + scrapeResult.pages.length;
                    var newPage =
                    {
                        level: level,
                        title: this.getTitle(),
                        url: this.getCurrentUrl()
                    };
                    scrapeResult.pages.push(newPage);
                    currentScrape.each.level = level;
                    casper.handleLinks(currentScrape.each, newPage);
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
            casper.echo(" -download: "+ newUrl);
            casper
                .thenOpen(workAroundUrl)
                .then(function () {
                    var base64pdf = casper.base64encode(newUrl);
                    var shapdf = sha.calcSHA1(base64pdf);
                    if (!scrapeResult.pages)
                        scrapeResult.pages = [];
                    // urlParts[urlParts.length - 1];
                    var level = currentScrape.level + "." + scrapeResult.pages.length;
                    var localUrl = level + ".pdf";
                    var newPage = {
                        level: level,
                        title: localUrl,
                        url: newUrl,
                        sha: shapdf
                    };
                    scrapeResult.pages.push(newPage);
                    try {
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
    this.echo("loadScrape: "+name);
    this.echo(jsonScrape);
    var scrape = JSON.parse(jsonScrape);
    fs.changeWorkingDirectory(scrape.name);
    casper
        .then(function () {
            scrape.level = "1";
            casper.handleLinks(scrape, scrapeResult);
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
                casper.loadScrape(file);
            }
        });
    }
});

casper.run(function () {
    this.exit();
});
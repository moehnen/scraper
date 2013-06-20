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
var links = [];
var f = utils.format;
var scrapeResult = {};



casper.on('error', function (msg, backtrace) {
    this.echo("=========================");
    this.echo("ERROR:");
    this.echo(msg);
    this.echo(backtrace);
    this.echo("=========================");
});

casper.on('resource.requested', function (resource, request) {

    casper.log("requested: " + resource['url'], "info");

    //if ((/http:\/\/ad./gi).test(resource['url'])) {
    //    console.log('The url of the request is matching. Aborting: ' + resource['url']);
    //    request.abort();
    //}
});

casper.handleLinks = function handleLinksFunction(currentScrape, scrapeResultPages) {

    var currentPage =
    {
        title: this.getTitle(),
        url: this.getCurrentUrl()
        , scraper: currentScrape

    };
    scrapeResultPages.push(currentPage);
    this.echo("getPage: " + this.getCurrentUrl());

    if (currentScrape.textpattern) {
        links = this.evaluate(function (currentScrape) {
            var links = [];
            Array.prototype.forEach.call(__utils__.findAll('a'), function (e) {
                //__utils__.echo('#' + e.innerText.trim() + '#');
                var re = new RegExp(currentScrape.textpattern.replace(/\*/g, ".*"));
                if (currentScrape.textpattern && e.innerText.match(re))
                {
                    var link = {
                        href: e.getAttribute('href'),
                        innerText: e.innerText
                    }
                    if (links.indexOf(link) === -1)
                        links.push(link);
                }
            });
            return links;
        }, currentScrape);

        this.echo("links: " + links.length);
        Array.prototype.forEach.call(links, function (link) {
            casper.handlePage(currentScrape, currentPage, link);
        });
    } else {
        casper.handlePage(currentScrape, currentPage, this.getCurrentUrl());
    }
};

casper.handlePage = function (currentScrape, currentPage, link) {
    var baseUrl = this.getGlobal('location').origin;
    var newUrl = helpers.absoluteUri(baseUrl, link.href);
    if (currentScrape.handle === "parse") {
        casper
            .thenOpen(newUrl)
            .then(function () {
                if (!currentPage.pages)
                    currentPage.pages = [];
                casper.handleLinks(currentScrape.each, currentPage.pages)
            });
    };
    if (currentScrape.handle === "screenshot") {
        casper
            .thenOpen(newUrl)
            .then(function () {
                if (!currentPage.pages)
                    currentPage.pages = [];
                try {
                    var base64png = casper.captureBase64('png');
                    var shapng = sha.calcSHA1(base64png);
                    //currentPage.pages.push(currentPage);
                    var newPage = {
                        title: currentScrape.textpattern,
                        url: newUrl,
                        sha: shapng
                    };
                    currentPage.pages.push(newPage);
                    var localUrl = shapng + '.png';
                    fs.write(localUrl, cu.decode(base64png), 'wb');
                    this.emit('downloaded.file', localUrl);
                    this.log(f("Downloaded and saved resource in %s", localUrl));
                } catch (e) {
                    this.log(f("Error while downloading %s to %s: %s", newUrl, localUrl, e), "error");
                }
            });

    };
    if (currentScrape.handle === "download") {
        var urlParts = newUrl.split("/"),
            workAroundUrl = urlParts[0] + "//" + urlParts[2];
        casper
            .thenOpen(workAroundUrl)
            .then(function () {
                if (!currentPage.pages)
                    currentPage.pages = [];
                try {
                    var base64pdf = casper.base64encode(newUrl);
                    var shapdf = sha.calcSHA1(base64pdf);
                    //currentPage.pages.push(currentPage);
                    var newPage = {
                        title: link.innerText.trim(),
                        url: newUrl,
                        sha: shapdf
                    };
                    currentPage.pages.push(newPage);
                    var localUrl = shapdf + '.pdf';
                    fs.write(localUrl, cu.decode(base64pdf), 'wb');
                    this.emit('downloaded.file', localUrl);
                    this.log(f("Downloaded and saved resource in %s", localUrl));
                } catch (e) {
                    this.log(f("Error while downloading %s to %s: %s", newUrl, localUrl, e), "error");
                }
            });
    }
};

casper.handleScrape = function (scraper) {
    fs.makeDirectory(scraper.name);
    fs.changeWorkingDirectory(scraper.name);
    scrapeResult['name'] = scraper.name;
    scrapeResult['pages'] = [];

    Array.prototype.forEach.call(scraper.pages, function (page) {
        casper
            .thenOpen(page)
            .then(function () {
                casper.handleLinks(scraper.each, scrapeResult.pages);
            });
    });
};

// Startseite
casper.start().then(function () {
    if (casper.cli.has(0)) {
        phantom.injectJs(casper.cli.get(0) + "/scrape.js");
    } else {
        var files = fs.list(".");
        Array.prototype.forEach.call(files, function (file) {
            if (fs.isDirectory(file) && fs.exists(file + "/scrape.js")) {
                casper.echo(file);
            }
        });
    }
    casper.handleScrape(this.scraper);
});

casper.run(function () {
    this.echo('========================================');
    this.echo(JSON.stringify(scrapeResult, null, '  '));
    fs.write(casper.scraper.name + "/result.json", JSON.stringify(scrapeResult, null, '\t'), 'w');
    this.exit();
});
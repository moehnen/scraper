// https://code.google.com/p/crypto-js/

var casper = require('casper').create({
    verbose: true
    //, logLevel: "debug"
});
var utils = require('utils');
var cu = require('clientutils').create();//utils.mergeObjects({}, this.options));
var helpers = require('./helpers'); // http://planzero.org/blog/2013/03/07/spidering_the_web_with_casperjs
var sha = require('./sha'); // http://membres-liglab.imag.fr/donsez/cours/exemplescourstechnoweb/js_securehash/sha1src.html
var fs = require('fs'); // https://github.com/ariya/phantomjs/wiki/API-Reference-FileSystem
var counter = 0;
var links = [];
var f = utils.format;
casper.scraper = {
    name: 'atu',
    pages: ["http://www.atu.de/pages/shop/atu-talk/tarif.html"],
    each: {
        handle: "download",
        textpattern: "Preisliste"
    }
}


casper.scraper = {
    name: "1und1",
    pages: ["https://mobile.1und1.de"],
    each: {
        handle: "parse",
        textpattern: "Tarifdetails",
        each: {
            handle: "download",
            textpattern: "PDF herunterladen"
        }
    }
};

var scrapeResult = {};

casper.on('error', function (msg, backtrace) {
    this.echo("=========================");
    this.echo("ERROR:");
    this.echo(msg);
    this.echo(backtrace);
    this.echo("=========================");
});

//casper.on("page.error", function (msg, backtrace) {
//    this.echo("=========================");
//    this.echo("PAGE.ERROR:");
//    this.echo(msg);
//    this.echo(backtrace);
//    this.echo("=========================");
//});

casper.handleScrape = function handleScrapeFunction(currentScrape, scrapeResultPages) {

    var currentPage =
    {
        title: this.getTitle(),
        url: this.getCurrentUrl()
        , scraper: currentScrape

    };
    scrapeResultPages.push(currentPage);
    this.echo("getPage: " + this.getCurrentUrl());

    links = this.evaluate(function (currentScrape) {
        var links = [];
        Array.prototype.forEach.call(__utils__.findAll('a'), function (e) {
            //__utils__.echo('#' + e.innerText.trim() + '#');
            if (currentScrape.textpattern && e.innerText.trim() === currentScrape.textpattern) {
                var link = e.getAttribute('href');
                if (links.indexOf(link) === -1)
                    links.push(link);
            }
        });
        return links;
    }, currentScrape);

    this.echo("links: " + links.length);
    var baseUrl = this.getGlobal('location').origin;
    Array.prototype.forEach.call(links, function (link) {
        var newUrl = helpers.absoluteUri(baseUrl, link);
        if (currentScrape.handle === "parse") {
            casper
                .thenOpen(newUrl)
                .then(function () {
                    if (!currentPage.pages)
                        currentPage.pages = [];
                    casper.handleScrape(currentScrape.each, currentPage.pages)
                });
        };
        if (currentScrape.handle === "download") {
            var urlParts = newUrl.split("/"),
                workAroundUrl = urlParts[0] + "//" + urlParts[2];
            casper
                .thenOpen(workAroundUrl)
                .then(function () {
                    try {
                        var base64pdf = casper.base64encode(newUrl);
                        var shapdf = sha.calcSHA1(base64pdf);
                        currentPage.pdf = {
                            url : newUrl,
                            sha : shapdf
                        };
                        var localUrl = casper.scraper.name +"/"+ currentPage.pdf.sha+ '.pdf';
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

// Startseite
casper.start().then(function () {
    fs.makeDirectory(this.scraper.name);
    scrapeResult['name'] = this.scraper.name;
    scrapeResult['pages'] = [];

    Array.prototype.forEach.call(this.scraper.pages, function (page) {
        casper
            .thenOpen(page)
            .then(function () {
                casper.handleScrape(this.scraper.each, scrapeResult.pages);
            });
    });
});

casper.run(function () {
    this.echo('========================================');
    this.echo(JSON.stringify(scrapeResult, null, '\t'));
    this.exit();
});
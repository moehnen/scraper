//var links = [];
var casper = require('casper').create({
    verbose: true
    , logLevel: "debug"
});
var utils = require('utils');
var helpers = require('./helpers'); // http://planzero.org/blog/2013/03/07/spidering_the_web_with_casperjs
var fs = require('fs'); // https://github.com/ariya/phantomjs/wiki/API-Reference-FileSystem

casper.userAgent('Mozilla/5.0 (Windows NT 6.1; WOW64; rv:17.0) Gecko/20100101 Firefox/17.0');

// Startseite
casper.start()


casper.thenOpen("http://daten.gtcom-partner.de", function () {
    this.echo("start");
    var url = 'http://daten.gtcom-partner.de/PDF/ATU_talk_Preisliste.pdf';
    this.echo("download");
    this.download(url, 'test.pdf');
    //this.download(url, 'test.pdf');
});

casper.run(function () {
    this.echo('========================================');

    this.exit();
});
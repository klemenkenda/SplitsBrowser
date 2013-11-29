/*
 *  SplitsBrowser Viewer - Top-level class that runs the application.
 *  
 *  Copyright (C) 2000-2013 Dave Ryder, Reinhard Balling, Andris Strazdins,
 *                          Ed Nash, Luke Woodward
 *
 *  This program is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation; either version 2 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License along
 *  with this program; if not, write to the Free Software Foundation, Inc.,
 *  51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 */
(function () {
    "use strict";
    // Delay in milliseconds between a resize event being triggered and the
    // page responding to it.
    // (Resize events tend to come more than one at a time; if a resize event
    // comes in while a previous event is waiting, the previous event is
    // cancelled.)
    var RESIZE_DELAY_MS = 100;

    // ID of the div that contains the competitor list.
    // Must match that used in styles.css.
    var COMPETITOR_LIST_CONTAINER_ID = "competitorListContainer";
    
    var ClassSelector = SplitsBrowser.Controls.ClassSelector;
    var ChartTypeSelector = SplitsBrowser.Controls.ChartTypeSelector;
    var ComparisonSelector = SplitsBrowser.Controls.ComparisonSelector;
    var StatisticsSelector = SplitsBrowser.Controls.StatisticsSelector;
    var CompetitorListBox = SplitsBrowser.Controls.CompetitorListBox;
    var Chart = SplitsBrowser.Controls.Chart;
    var ResultsTable = SplitsBrowser.Controls.ResultsTable;
    
    /**
    * Enables or disables a control, by setting or clearing an HTML "disabled"
    * attribute as necessary.
    * @param {d3.selection} control - d3 selection containing the control.
    * @param {boolean} isEnabled - Whether the control is enabled.
    */
    function enableControl(control, isEnabled) {
        control.node().disabled = !isEnabled;
    }
    
    /**
    * The 'overall' viewer object responsible for viewing the splits graph.
    * @constructor
    */
    var Viewer = function () {
    
        this.eventData = null;
        this.classes = null;
        this.currentClasses = [];
        this.currentIndexes = null;
        this.chartData = null;
        this.referenceCumTimes = null;
        this.fastestCumTimes = null;
        this.previousCompetitorList = [];
        
        this.isChartEnabled = false;

        this.selection = null;
        this.ageClassSet = null;
        this.classSelector = null;
        this.statisticsSelector = null;
        this.competitorListBox = null;
        this.chart = null;
        this.topPanel = null;
        this.mainPanel = null;
        this.buttonsPanel = null;
        this.competitorListContainer = null;
        
        this.currentResizeTimeout = null;
    };
    
    /**
    * Sets the classes that the viewer can view.
    * @param {SplitsBrowser.Model.Event} eventData - All event data loaded.
    */
    Viewer.prototype.setEvent = function (eventData) {
        this.eventData = eventData;
        this.classes = eventData.classes;
        if (this.classSelector !== null) {
            this.classSelector.setClasses(this.classes);
        }
    };

    /**
    * Construct the UI inside the HTML body.
    */
    Viewer.prototype.buildUi = function () {
        var body = d3.select("body");
        
        this.topPanel = body.append("div");
                           
        var outerThis = this;
        this.classSelector = new ClassSelector(this.topPanel.node());
        if (this.classes !== null) {
            this.classSelector.setClasses(this.classes);
        }
        
        this.topPanel.append("span").style("padding", "0px 30px 0px 30px");
        
        var types = SplitsBrowser.Model.ChartTypes;
        var chartTypes = [types.SplitsGraph, types.RaceGraph, types.PositionAfterLeg,
                          types.SplitPosition, types.PercentBehind, types.ResultsTable];
        
        this.chartTypeSelector = new ChartTypeSelector(this.topPanel.node(), chartTypes);
        
        this.chartType = this.chartTypeSelector.getChartType();
        
        this.topPanel.append("span").style("padding", "0px 30px 0px 30px");
        
        this.comparisonSelector = new ComparisonSelector(this.topPanel.node(), function (message) { alert(message); });
        if (this.classes !== null) {
            this.comparisonSelector.setClasses(this.classes);
        }
        
        this.comparisonFunction = this.comparisonSelector.getComparisonFunction();
        
        this.statisticsSelector = new StatisticsSelector(this.topPanel.node());
        
        this.mainPanel = body.append("div");
        
        this.competitorListContainer = this.mainPanel.append("div")
                                                     .attr("id", COMPETITOR_LIST_CONTAINER_ID);
                                               
        this.buttonsPanel = this.competitorListContainer.append("div");
                     
        this.allButton = this.buttonsPanel.append("button")
                                          .text("All")
                                          .style("width", "50%")
                                          .on("click", function () { outerThis.selectAll(); });
                        
        this.noneButton = this.buttonsPanel.append("button")
                                           .text("None")
                                           .style("width", "50%")
                                           .on("click", function () { outerThis.selectNone(); });
                        
        this.buttonsPanel.append("br");
                        
        this.crossingRunnersButton = this.buttonsPanel.append("button")
                                                      .text("Crossing runners")
                                                      .style("width", "100%")
                                                      .on("click", function () { outerThis.selectCrossingRunners(); })
                                                      .style("display", "none");

        this.competitorListBox = new CompetitorListBox(this.competitorListContainer.node());
        this.chart = new Chart(this.mainPanel.node());
        
        this.resultsTable = new ResultsTable(body.node());
        this.resultsTable.hide();
        
        this.classSelector.registerChangeHandler(function (indexes) { outerThis.selectClasses(indexes); });
        
        this.chartTypeSelector.registerChangeHandler(function (chartType) { outerThis.selectChartType(chartType); });
        
        this.comparisonSelector.registerChangeHandler(function (comparisonFunc) { outerThis.selectComparison(comparisonFunc); });
           
        $(window).resize(function () { outerThis.handleWindowResize(); });
    };

    /**
    * Select all of the competitors.
    */
    Viewer.prototype.selectAll = function () {
        this.selection.selectAll();
    };

    /**
    * Select none of the competitors.
    */
    Viewer.prototype.selectNone = function () {
        this.selection.selectNone();
    };

    /**
    * Select all of the competitors that cross the unique selected competitor.
    */
    Viewer.prototype.selectCrossingRunners = function () {
        this.selection.selectCrossingRunners(this.ageClassSet.allCompetitors); 
        if (this.selection.isSingleRunnerSelected()) {
            var competitorName = this.ageClassSet.allCompetitors[this.currentIndexes[0]].name;
            alert(competitorName + " has no crossing runners.");
        }
    };

    /**
     * Handle a resize of the window.
     */
    Viewer.prototype.handleWindowResize = function () {
        if (this.currentResizeTimeout !== null) {
            clearTimeout(this.currentResizeTimeout);
        }

        var outerThis = this;
        this.currentResizeTimeout = setTimeout(function() { outerThis.postResizeHook(); }, RESIZE_DELAY_MS);
    };
    
    /**
    * Resize the chart following a change of size of the chart.
    */
    Viewer.prototype.postResizeHook = function () {
        this.currentResizeTimeout = null;
        this.drawChart();
    };

    /**
    * Draw the chart using the current data.
    */
    Viewer.prototype.drawChart = function () {
        if (this.chartType.isResultsTable) {
            return;
        }
        
        var windowWidth = $(window).width();
        var windowHeight = $(window).height();

        this.competitorListBox.setCompetitorList(this.ageClassSet.allCompetitors, (this.currentClasses.length > 1));

        var topPanelHeight = $(this.topPanel.node()).height();
        
        // Subtract some values to avoid scrollbars appearing.
        var chartWidth = windowWidth - 18 - this.competitorListBox.width() - 40;
        var chartHeight = windowHeight - 19 - topPanelHeight;

        this.chart.setSize(chartWidth, chartHeight);
        
        $("body").height(windowHeight - 19 - topPanelHeight);
        $(this.competitorListContainer.node()).height(windowHeight - 19 - $(this.buttonsPanel.node()).height() - topPanelHeight);
        
        this.currentVisibleStatistics = this.statisticsSelector.getVisibleStatistics();
        
        if (this.selectionChangeHandler !== null) {
            this.selection.deregisterChangeHandler(this.selectionChangeHandler);
        }
        
        if (this.statisticsChangeHandler !== null) {
            this.statisticsSelector.deregisterChangeHandler(this.statisticsChangeHandler);
        }
        
        var outerThis = this;
        
        this.selectionChangeHandler = function (indexes) {
            outerThis.currentIndexes = indexes;
            outerThis.enableOrDisableCrossingRunnersButton();
            outerThis.redraw();
        };

        this.selection.registerChangeHandler(this.selectionChangeHandler);
        
        this.statisticsChangeHandler = function (visibleStatistics) {
            outerThis.currentVisibleStatistics = visibleStatistics;
            outerThis.redraw();
        };
        
        this.statisticsSelector.registerChangeHandler(this.statisticsChangeHandler);

        var missedControls = this.ageClassSet.getControlsWithNoSplits();
        this.isChartEnabled = (missedControls.length === 0);
        this.updateControlEnabledness();
        if (this.isChartEnabled) {
            this.referenceCumTimes = this.comparisonFunction(this.ageClassSet);
            this.fastestCumTimes = this.ageClassSet.getFastestCumTimes();
            this.chartData = this.ageClassSet.getChartData(this.referenceCumTimes, this.currentIndexes, this.chartType);
            this.redrawChart();
        } else {
            var message = "Cannot draw a graph because no competitor has recorded a split time for control " + missedControls[0] + ".";
            if (this.ageClassSet.getCourse().getNumClasses() > this.ageClassSet.getNumClasses()) {
                message += "\n\nTry selecting some other classes.";
            }
            
            this.chart.clearAndShowWarning(message);
        }
    };

    /**
    * Redraws the chart using all of the current data.
    */ 
    Viewer.prototype.redrawChart = function () {
        var data = {
            chartData: this.chartData,
            eventData: this.eventData,
            ageClassSet: this.ageClassSet,
            referenceCumTimes: this.referenceCumTimes,
            fastestCumTimes: this.fastestCumTimes
        };
            
        this.chart.drawChart(data, this.currentIndexes, this.currentVisibleStatistics, this.chartType);
    };
    
    /**
    * Redraw the chart, possibly using new data.
    */
    Viewer.prototype.redraw = function () {
        if (!this.chartType.isResultsTable && this.isChartEnabled) {
            this.chartData = this.ageClassSet.getChartData(this.referenceCumTimes, this.currentIndexes, this.chartType);
            this.redrawChart();
        }
    };
    
    /**
    * Change the graph to show the classes with the given indexes.
    * @param {Number} classIndexes - The (zero-based) indexes of the classes.
    */
    Viewer.prototype.selectClasses = function (classIndexes) {
    
        if (this.selection === null) {
            this.selection = new SplitsBrowser.Model.CompetitorSelection(0);
            this.competitorListBox.setSelection(this.selection);
        } else {
            if (classIndexes.length > 0 && this.currentClasses.length > 0 && this.classes[classIndexes[0]] === this.currentClasses[0]) {
                // The 'primary' class hasn't changed, only the 'other' ones.
                // In this case we don't clear the selection.
            } else {
                this.selection.selectNone();
            }
        }
        
        this.currentIndexes = [];
        this.currentClasses = classIndexes.map(function (index) { return this.classes[index]; }, this);
        this.ageClassSet = new SplitsBrowser.Model.AgeClassSet(this.currentClasses);
        this.comparisonSelector.setAgeClassSet(this.ageClassSet);
        this.resultsTable.setClass(this.currentClasses[0]);
        this.drawChart();
        this.selection.migrate(this.previousCompetitorList, this.ageClassSet.allCompetitors);
        this.previousCompetitorList = this.ageClassSet.allCompetitors;
    };
    
    /**
    * Change the graph to compare against a different reference.
    * @param {Function} comparisonFunc - The function that returns the
    *      reference class data from the class data.
    */
    Viewer.prototype.selectComparison = function (comparisonFunc) {
        this.comparisonFunction = comparisonFunc;
        this.drawChart();
    };
    
    /**
    * Change the type of chart shown.
    * @param {Object} chartType - The type of chart to draw.
    */
    Viewer.prototype.selectChartType = function (chartType) {
        this.chartType = chartType;
        if (chartType.isResultsTable) {
            this.mainPanel.style("display", "none");
            this.resultsTable.show();
        } else {
            this.resultsTable.hide();
            this.mainPanel.style("display", "");
        }
        
        this.updateControlEnabledness();
        
        this.crossingRunnersButton.style("display", (chartType.isRaceGraph) ? "" : "none");
        
        this.drawChart();
    };
    
    /**
    * Updates whether a number of controls are enabled.
    */
    Viewer.prototype.updateControlEnabledness = function () {
        this.classSelector.setOtherClassesEnabled(!this.chartType.isResultsTable);
        this.comparisonSelector.setEnabled(this.isChartEnabled && !this.chartType.isResultsTable);
        this.statisticsSelector.setEnabled(this.isChartEnabled && !this.chartType.isResultsTable);
        this.competitorListBox.setEnabled(this.isChartEnabled);
        enableControl(this.allButton, this.isChartEnabled);
        enableControl(this.noneButton, this.isChartEnabled);
        this.enableOrDisableCrossingRunnersButton();
    };
    
    /**
    * Enables or disables the crossing-runners button as appropriate.
    */
    Viewer.prototype.enableOrDisableCrossingRunnersButton = function () {
        enableControl(this.crossingRunnersButton, this.isChartEnabled && this.selection.isSingleRunnerSelected());
    };
    
    SplitsBrowser.Viewer = Viewer;
    
    /**
    * Handles an asynchronous callback that fetched event data, by parsing the
    * data and starting SplitsBrowser.
    * @param {String} data - The data returned from the AJAX request.
    * @param {String} status - The status of the request.
    */
    function readEventData(data, status) {
        if (status === "success") {
            var eventData = SplitsBrowser.Input.parseEventData(data);
            if (eventData === null) {
                alert("Unable to read in event data file");
            } else {
                var viewer = new Viewer();
                viewer.buildUi();
                viewer.setEvent(eventData);
                viewer.selectClasses([0]);
            }
        } else {
            alert("Unable to read event data.  Status: " + status);
        }
    }

    /**
    * Loads the event data in the given URL and starts SplitsBrowser.
    * @param {String} eventUrl - The URL that points to the event data to load.
    */
    SplitsBrowser.loadEvent = function (eventUrl) {
        $.ajax({
            url: eventUrl,
            data: "",
            success: readEventData,
            dataType: "text"
        });
    };    
})();

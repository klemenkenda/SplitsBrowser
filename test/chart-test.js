﻿/* global d3 */
/* global QUnit, module, expect, document */
/* global SplitsBrowser */

(function () {
    "use strict";

    var Chart = SplitsBrowser.Controls.Chart;
    var fromSplitTimes = SplitsBrowser.Model.Competitor.fromSplitTimes;
    var Course = SplitsBrowser.Model.Course;

    var TEXT_WIDTHS = {
        "Fred Brown": 85,
        "John Smith": 100,
        "00:28": 58,
        "03:41 (2)": 77,
        "09:56 (2)": 77
    };

    var TEXT_HEIGHTS = {
        "Fred Brown": 12,
        "John Smith": 12
    };

    // Dummy functions for returning the width/height of pieces of text.
    function getTextWidth(text) {
        while (text.substring(0, 1) == "\xa0") {
            text = text.substring(1);
        }
        
        if (text in TEXT_WIDTHS) {
            return TEXT_WIDTHS[text];
        } else {
            throw new Error("Width of text '" + text + "' not known");
        }
    }

    function getTextHeight(text) {
        if (text in TEXT_HEIGHTS) {
            return TEXT_HEIGHTS[text];
        } else {
            throw new Error("Height of text '" + text + "' not known");
        }
    }

    // Utility function to set up a chart in a parent element and mock out the
    // width and height methods.
    function createTestChart() {
        var div = document.createElement("div");
        var chart = new Chart(div);
        chart.getTextWidth = getTextWidth;
        chart.getTextHeight = getTextHeight;
        return chart;
    }

    module("Chart");

    QUnit.test("Can create a chart", function (assert) {
        var competitor1 = fromSplitTimes(1, "Fred", "Brown", "DEF", "10:30", [81, 197, 212, 106]);
        var competitor2 = fromSplitTimes(2, "John", "Smith", "ABC", "10:00", [65, 221, 184, 100]);
        var course = new Course("Test", 3, [competitor1, competitor2]);
        var fastestCumTimes = course.getFastestCumTimes();
        var chartData = course.getChartData(fastestCumTimes, [0, 1]);

        var chart = createTestChart();
        chart.setSize(1000, 1000);
        chart.drawChart(chartData, course, fastestCumTimes, [0, 1], [true, true, true]);

        // Most of the testing of the chart functionality is visual, so it isn't
        // realistic to perform any automated tests for this.  However, it is
        // useful to have a check that the code at least runs without errors.  So
        // we do no further testing.

        // Tell QUnit that no assertions are expected.  If we don't do this, it
        // will complain that the test isn't testing anything.
        expect(0);
    });
})();
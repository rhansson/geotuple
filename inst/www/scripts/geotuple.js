/* Copyright (c) 2015 Roland Hansson - Nova Spatial LLC.  
 
  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

var L; // Leaflet
var L_map;
var L_markerLayer;
var L_geojsonLayer;
var G_activeTool;
var G_themes;
var G_themeProps;
var G_themeStats = [];
var G_mapTheme;
var G_alzThemeY = null;
var G_alzThemesX = [];
var G_alzResults = [];
var G_hliteThemes = [];
var G_hliteFilters = {};
var G_session = null;
var G_points = [];  // point features
var G_crIsReversed = false;
var center_barea = [[37.589, -122.144], 10];
var center_lacnty = [[34.082, -118.223], 10];
var center_bhills = [[34.0804, -118.4125], 13];

function ThemeStats(key) {
  this.key = key;
  this.valStats = {'min':0, 'max':-1, 'avg':0}
  this.hotStats = {'min':0, 'max':-1, 'avg':0}
}
function Theme(key) {
  this.key = key;
  this.min;
  this.max;
  this.avg;
  this.units;
  this.symbols = null;
  this.style = "val";
  this.domain = "map";
  this.opacity = 0.6;
}
Theme.prototype.draw = function(points, map, markerLayer) {
  $("#mapmsg").text("Drawing "+points.length+" points...");
  markerLayer.clearLayers();  // reset map
  var arrLen = points.length;  
  
  /*  ----------------------- assign colors */
  var column = this.key;  // column value  
  var values = null;
  if (this.type == "categorical") {    
    var val = points[0][this.key];
    values = [val];  // build array of unique values
    var maxNumVals = 99;  // number of colors in range ***
    for (var i=1; i<points.length; i++) {
      if (values.length > maxNumVals) break;
      val = points[i][this.key];
      if (jQuery.inArray(val, values) < 0) {
        values.push(val);
      }      
    }
  }
  //console.log(points[0][column])
  var colorRange = setColorRange(getThemeByKey(G_mapTheme.key, G_themes).color);
  var stats = getThemeByKey(G_mapTheme.key, G_themeStats);
  var theme = jQuery.extend({}, G_mapTheme)  // clone 
  if (this.style == "hot") {
    column = "Getis";    
    colorRange = setColorRange("RdBu"); 
    if (!G_crIsReversed) {
      colorRange.reverse();   // Red-Blue -> Blue-Red for legend only     
      G_crIsReversed = true;  // do this only once ... got to be a better way ...
    }   
    theme.units = "Z score"
    theme.min = stats.hotStats.min; theme.avg = stats.hotStats.avg; theme.max = stats.hotStats.max;
  } else {  // value
    if (theme.domain == "map") {
      theme.min = stats.valStats.min; theme.avg = stats.valStats.avg; theme.max = stats.valStats.max;
    } else {  // default
      var themeProps = getThemeByKey(G_mapTheme.key, G_themeProps);
      theme.min = themeProps.min; theme.avg = themeProps.avg; theme.max = themeProps.max;
    }
  }
  //console.log(theme)
  var symbolRange = drawLegend(theme, colorRange, this.style, values);   
  this.symbols = symbolRange;

  /* ----------------------- symbolize points */  
  var markerSize = 9;  // px
  var markerOpts = {
    radius: markerSize,
    fillColor: '#FFFFFF',
    stroke: false,
    color: "Cyan",  // highlight
    weight: markerSize / 3,  // highlight
    fillOpacity: this.opacity
  }
  //console.log(points[0])
  var symbols = this.symbols;  
  var p, val = null;
  for (var i=0; i<arrLen; i++) {
    p = points[i];    
    val = p[column];    
    markerOpts['fillColor'] = symbols(val).toString();
    if (isHighlight(p)) {
      markerOpts['stroke'] =  true; 
    } else {
      markerOpts['stroke'] =  false;
    }
    var marker = L.circleMarker([p.y, p.x], markerOpts);
    markerLayer.addLayer(marker);                       
  }                              
  map.invalidateSize();  // force redraw
  $("#mapmsg").text("Drawing "+points.length+" points.");
};

function isHighlight(p) {
  var numThemes = G_hliteThemes.length;
  if (numThemes < 1) {
    return false;
  } else {
    //G_hliteFilters['z'] = ">100";
    var val, column, filter = null;
    for (var i=0; i<numThemes; i++) {
      column = G_hliteThemes[i];
      val = p[column];
      filter = val+G_hliteFilters[column];
      if (!(eval(filter))) {
        return false;  // assume: filter_1 AND filter_2 AND .. filter_n
      }
    }
  }
  return true;
}


/* -------------------------- */
$(document).ready(function() {
  console.log("document ready"); 
  $('#msg').text("Loading...");
  $('#refresh').prop('checked', true);
  $('#plot-chk').prop('checked', true);

  // load data themes
  var prom1 = jQuery.getJSON("data/themes.json");
  prom1.then(function(data) {          
    var numThemes = data.themes.length;
    console.log(numThemes +" themes")
    if (numThemes>0) {
      G_themes = data["themes"];
    }    
  });
  
  var prom2 = jQuery.getJSON("data/themeprops.json");
  prom2.then(function(data) { 
    var numThemes = data.themeprops.length;
    console.log(numThemes +" themeprops")
    if (numThemes>0) {
      G_themeProps = data["themeprops"];
    }
  });  

  // Request geotuple data and draw map when all json loaded
  jQuery.when(prom1, prom2).done(function() {
    // prom1
    G_mapTheme = new Theme(G_themes[0].key);
    loadThemesToTable(G_themes);  // Note: including binding click events to table
    // prom2
    G_themeStats.push(new ThemeStats(G_mapTheme.key)); 
    var themeProps = getThemeByKey(G_mapTheme.key, G_themeProps);
    var colorRange = setColorRange(getThemeByKey(G_mapTheme.key, G_themes).color);
    G_mapTheme.units = themeProps.units;
    var symbolRange = drawLegend(themeProps, colorRange); 
    G_mapTheme.symbols = symbolRange;

    var req = ocpu.rpc("init", {}, function(data) {  // retrieve the returned object async
      //console.log(data)      
      var t = data[0];
      if (t) {  // not null 
        console.log("Loading Mapbox");
        // set up Mapbox
        L.mapbox.accessToken = t;  // Your Access Token here
        L_map = L.mapbox.map('map', 'mapbox.light', {
          maxZoom: 17, 
          minZoom: 5,
          legendControl: {
            position: 'topright'
          } 
        }).setView(center_barea[0], center_barea[1])
        
        L.control.scale().addTo(L_map); 
        //L_map.addLayer(L_geojsonLayer);  // study area
        L_map.on("moveend", refreshMap);  // Fired when the view of the map stops changing (incl zoom)

        // create marker layer for themes
        L_markerLayer = L.mapbox.featureLayer().addTo(L_map);
        // draw map
        refreshMap(null); 

        $('#navlist a[href$="#1"]').click();  // trigger nav link as active
        $('#themes tr:eq(1) td:nth-child(1)').click();  // trigger table init
        $('#msg').text("Select a theme of interest:");
      } else {
        $("#mapmsg").text("No token returned");      
      }    
    });
  });

  // UI elements
  //
  $('#navlist a').click(function(e) {    
    e.preventDefault();
    $('#navlist a').removeClass('active');
    $('#navlist a').addClass('nav');
    $(this).toggleClass('nav');
    $(this).toggleClass('active');
    var tool = $(this)[0].text;
    setActiveTool(tool); 
    $('#themes tr:eq(1) td:nth-child(8)').click();  // trigger table reset
  });

  $('#legend-domain').on('change', function() {
    var selDomain = $('#legend-domain').find('option:selected').val();
    var currStyle = G_mapTheme.style;
    if (currStyle == "val") { 
      G_mapTheme.domain = selDomain;
      G_mapTheme.draw(G_points, L_map, L_markerLayer);
    } else {  // hot
      //$('#legend-domain').val("map").change();  // don't allow change /*** why stack error?? ***/
    }
  });

  $('#tool-opt1').on("change", function() {
    var newOpt = $("#tool-opt1").find('option:selected').val();
    if (newOpt == "cor" || newOpt == "reg") { 
      setSlideInfo([newOpt].concat(G_alzResults[newOpt]));
      return;  // Analyze option
    }
    var currStyle = G_mapTheme.style;    
    if (currStyle == newOpt) {
      return;
    }
    G_mapTheme.style = newOpt;
    if (currStyle == "val" && newOpt == "hot") {
      $('#legend-domain').val("map").change();  // don't allow change                
    } 
    refreshMap(null);
  });

  $("#compute-btn").on("click", function() {
    if (G_alzThemeY === null) {
      $('#msg').text("Select a theme (Y) to analyze");
    } else { 
      var type = $("#tool-opt1").find('option:selected').val();
      runAnalysis(type);
    }
  });

  $('#menu-itm a').on('click', function(e) {
    var itm = ($(this).attr('id'));
    //console.log(itm)
    $("#msg").css("background-color","White");        // should be toggle
    if (itm == "apikey") {
      var req = ocpu.call("getKey", {
        x : ""
      }, function(session) {  // retrieve the returned object async
        session.getObject(function(data) {
          var apikey = session.getKey();
          //console.log(apikey)
          $("#msg").text(data[0] + apikey);
          $("#msg").css("background-color","Yellow");   // should be toggle
        });     
        req.fail(function(){
          alert("Server error: " + req.responseText);
        });
        req.always(function(){
          //$('#menu-itm').hide();
        });
      });
    } else if (itm == "bookm-ba") {
      L_map.setView(center_barea[0], center_barea[1]);
      //refreshMap(null);
    } else if (itm == "bookm-la") {
      L_map.setView(center_lacnty[0], center_lacnty[1]);
    } else if (itm == "bookm-bh") {
      L_map.setView(center_bhills[0], center_bhills[1]);
    } else {
     /* TO DO ***/
    }
  });

  $('#plot-chk').on("change", function() {
    if ($(this).is(":checked")) {
      $('#plot').show();
      $('#themes').hide();
      $('#more').hide();
    } else {
      $('#plot').hide();
      $('#themes').show();
      $('#more').show();
    }
  });

  $('#more').on("click", function() {
    alert("This is just a sample of data themes. For now!");
  });

  // open dynamic slide-in panel
  $('#themeinfo-btn').on("click", function(event){
    event.preventDefault();
    $('.cd-panel').addClass('is-visible');
  });
  $('#computeinfo-btn').on("click", function(event){
    event.preventDefault();
    var type = $("#tool-opt1").find('option:selected').val();
    setSlideInfo([type].concat(G_alzResults[type]));
    $('.cd-panel').addClass('is-visible');
  });
  //close the lateral panel
  $('.cd-panel').on('click', function(event){
    if( $(event.target).is('.cd-panel') || $(event.target).is('.cd-panel-close') ) { 
      $('.cd-panel').removeClass('is-visible');
      event.preventDefault();
    }
  });

  $('#download').on("click", function() {
    var data = G_points;
    var props = [];
    for (var p in data[0]) {
      if (p != "x" && p != "y") {
        props.push(p);
      }
    }
    //console.log(props)
    var geojson = {};
    geojson['type'] = 'FeatureCollection';
    geojson['features'] = [];
    for (var i in data) {
      var vals = [];
      for (var j in props) {
        vals.push(data[i][props[j]]);
      }
      // gather key: value pairs
      var properties_arr = [];
      for (var n = 0; n < vals.length; n++) {
        var pair = {};
        for (var p = 0; p < props.length; p++) {
          pair[props[p]] = vals[n];
        }
        properties_arr.push(pair);
      }
      //console.log(properties);
      var properties = properties_arr[0];
      var newFeature = {
        "type": "Feature",
        "geometry": {
          "type": "Point",
          "coordinates": [parseFloat(data[i].x), parseFloat(data[i].y)]
        },
        properties
        //"properties": {"z": data[i].z}
      }
      geojson['features'].push(newFeature);
    }
    //console.log(geojson)
    /*
    console.log(L_markerLayer.toGeoJSON());
    // Extract GeoJson from featureLayer *** has only coords
    var geojson = L_markerLayer.toGeoJSON();
    */
    // Stringify the GeoJson
    var data = 'text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(geojson));
    // Create download
    // NOTICE Safari ignores the download directive - https://forums.developer.apple.com/thread/11837
    // use [C]+[s]
    document.getElementById("download").setAttribute('href','data:text/json' + data);
    document.getElementById("download").setAttribute('download','geotuple.geojson');
  });

});  // document.ready


function setActiveTool(t) {
  t = t.toLowerCase();
  $('#themeinfo-btn').hide();
  $('#compute-btn').hide();
  $('#compute-div').hide();
  $('#tool-opt1').css('visibility', 'visible');
  $("#tool-opt1").prop('disabled', false);
  $('#plot-chk-div').hide();
  $('#results-div').show();
  $('#info').html("");
  $('#sethlite-btn').hide();
  $('#sethlite-btn').css("background-color","White");
  $('#sethlite-opt').hide();
  $('#sethlite-opt-lab').text("");
  $('#plot').hide();
  $('#themes').show();
  $('#more').show();
  if (t=="map") {
    var prevOpt = "val"
    if (G_mapTheme.style) {
      prevOpt = G_mapTheme.style;
    } 
    $('#tool-opt1')
      .empty()
      .append($("<option></option>")
        .attr("value","val")
        .text("Value"))
      .append($("<option></option>")
        .attr("value","hot")
        .text("Hot-Spot"))
      .val(prevOpt).change()
      .show();
    $('#themeinfo-btn').show();
    setSlideInfo(getThemeByKey(G_mapTheme.key, G_themeProps));
  } else if (t=="analyze") {    
    $('#tool-opt1')
      .empty()
      .append($("<option></option>")
        .attr("value","cor")
        .text("Correlation"))
      .append($("<option></option>")
        .attr("value","reg")
        .text("Regression"))
      .show();
    $('#compute-btn').show();
    $('#plot-chk-div').show(); 
    $('#compute-div').show(); 
    var type = $("#tool-opt1").find('option:selected').val();
    setSlideInfo([type].concat(G_alzResults[type]));
  } else {  // highlight
    $('#sethlite-btn').show();
    $('#tool-opt1').css('visibility', 'hidden');  // keep space
    //$('#compute-div').hide();
  } 
  G_activeTool = t;
  $('#msg').text("");
}

function loadThemesToTable(themes) { 
  var k, v;
  for (var i=0; i<themes.length; i++) {
    k = themes[i].key;
    v = themes[i].name;
    $('#themes').find('tbody')
      .append($('<tr>')
        .append($('<td>').text(k))
        .append($('<td>')
          .append($('<input>')
            .attr('type', "radio")
            .attr('name', "radio1")
            .attr('title', "Draw theme"))
        )
        .append($('<td>')
        .append($('<input>')
          .attr('type', "radio")
          .attr('name', "radio2")
          .attr('title', "Dependent variable (Y)"))
        )
        .append($('<td>')
          .append($('<input>')
            .attr('type', "checkbox")
            .attr('title', "Independent variables (X)"))
        )        
        .append($('<td>')
          .append($('<input>')
            .attr('type', "checkbox")
            .attr('title', "Highlight theme"))
        )
        .append($('<td>').text("...")
            .attr('title', "Edit criteria"))
        .append($('<td>').text(v))
        .append($('<td>').text("trig"))
    );
  }  
  $('#themes th').eq(0).hide();

  /*** MUST PLACE HERE (function) in order to bind to table ***/
  $('#themes td').click(function(e){    
  // http://stackoverflow.com/questions/6290701/jquery-click-on-table-cell-event    
  // http://stackoverflow.com/questions/788225/table-row-and-column-number-in-jquery
  // http://stackoverflow.com/questions/5624704/how-to-set-table-cell-value-using-jquery
  /*
  * Table stucture: 
  * ---------------
  *  0 key      -         text (hidden tag)
  *  1 Draw     map       radio
  *  2 Y        analyze   radio
  *  3 X1..     analyze   checkbox
  *  4 Draw     highlight checkbox
  *  5 Edit     higlight  text
  *  6 Theme    all       text (visible)
  *  7 trig     -         text (hidden tag)
  */

    // build array of table for convenient access
    var arrTab = $('#themes > tbody > tr').map(function() {
      return $(this).children().map(function() {
        return $(this);
      });
    });
    var tr = $(this).closest('tr');
    var col = $(this).index();
    var row = tr.index();
    //console.log(G_activeTool+" Row:"+row+" Col:"+col)    
    if (col < 7) {
      var key = arrTab[row][0].text();
    }  // else triggered by nav link    

    // reset visible headings/columns
    $('#themes th').eq(1).hide();
    $('#themes th').eq(2).hide();
    $('#themes th').eq(3).hide();
    $('#themes th').eq(4).hide();
    $('#themes th').eq(5).hide();
    $('#themes tr').each(function () {
      $(this).find('td').each(function () {
        $(this).hide();  // hides all columns
      });
    });

    if (col == 0) {  // init trigger
      $('#themes th').eq(1).show();
      $('#themes tr').each(function () {
        $(this).find('td').eq(1).show();
        $(this).find('td').eq(6).show();
      });
      if (row > 1) {
        e.stopPropagation();  /* not working for below... ***/
        return false;
      }
      // set 1st theme as active map and dependent (Y) for analyze
      tr.find('input:radio').attr('checked', true);
      arrTab[1][6].css("background-color","LightGreen");      
      arrTab[1][6].css("font-weight","bold"); 
      G_alzThemeY = key;
      setSlideInfo(getThemeByKey(G_mapTheme.key, G_themeProps)); 
    }

    if (G_activeTool == "map") {
      $('#msg').text("Select a theme to draw on map");
      $('#themes th').eq(1).show();
      $('#themes tr').each(function () {
        $(this).find('td').eq(1).show();
        $(this).find('td').eq(6).show();
      });      
      if (col == 1) {  // set draw
        setSlideInfo(getThemeByKey(key, G_themeProps)); 
        var currKey = G_mapTheme.key;        
        if (currKey == key) { 
          if ($(event.target).is('input')) {
            $(this).find('input').prop('checked', true);  // don't allow un-check radio button
          } else {
            $(this).find('input').prop('checked', false); // don't allow un-check outside radio
          }
          return;
        }
        G_mapTheme.key = key; 
        var themeProps = getThemeByKey(G_mapTheme.key, G_themeProps);
        G_mapTheme.units = themeProps.units;
        G_mapTheme.type = themeProps.type;
        if (G_mapTheme.type == "categorical") {         
          $("#tool-opt1").val('val');  
          G_mapTheme.style = 'val';  // can only use Value
          $("#tool-opt1").prop('disabled', true);
        } else {
          $("#tool-opt1").prop('disabled', false);
        }
        $('#themes tr td:nth-child(7)').each(function () {
          $(this).css("background-color","White");  // reset all rows
        });
        arrTab[row][6].css("background-color","LightGreen");
        refreshMap(null);
      } else if (col == 6) {
        setSlideInfo(getThemeByKey(key, G_themeProps)); 
      }

    } else if (G_activeTool == "analyze") {
      $('#msg').text("Select a theme (Y) and one or more themes (X) to analyze relationship with");
      $('#themes th').eq(2).show();
      $('#themes th').eq(3).show();
      $('#themes tr').each(function () {
        $(this).find('td').eq(2).show();
        $(this).find('td').eq(3).show();
        $(this).find('td').eq(6).show();
      });
      if (col == 2) {  // set Y
        if ($(event.target).is('input')) {
          $(this).find('input').prop('checked', true);  // don't allow un-check radio button
        } else {
          $(this).find('input').prop('checked', false); // don't allow un-check outside radio
        }
        $('#themes tr td:nth-child(7)').each(function () {
          $(this).css("font-weight","normal");  // reset all rows
        });
        arrTab[row][6].css("font-weight","bold");
        arrTab[row][6].css("font-style","normal");        
        $('#themes tr td:nth-child(4)').each(function () {
          $(this).css("background-color","White");  /* hack disabled... **/
        });
        arrTab[row][3].css("background-color","LightGray");  /* hack disabled... **/
        var i = jQuery.inArray(key, G_alzThemesX);
        if (i >= 0) {
          tr.find('td:nth-child(4) input[type="checkbox"]').prop('checked', false); 
          G_alzThemesX.splice(i, 1)  // remove
        }
        G_alzThemeY = key;
      }
      else if (col == 3) {  // set X
        if (G_alzThemeY == key) {          
          $('#msg').text("Theme cannot be both X and Y! Please select another theme.");
          arrTab[row][6].css("font-style","normal");
          $('#themes tr td:nth-child(4)').each(function () {
            e.preventDefault();  // don't allow check on row = Y
          }); 
          if ($(event.target).is('input')) {
            $(this).find('input').prop('checked', false); // don't allow check button
          } else {
            $(this).find('input').prop('checked', true);  // don't allow check outside button
          }
          return;
        }
        if (jQuery.inArray(key, G_alzThemesX) !== -1) {          
          var i = jQuery.inArray(key, G_alzThemesX);          
          G_alzThemesX.splice(i, 1)  // remove
          arrTab[row][6].css("font-style","normal");          
          arrTab[row][3].css("background-color","White");  /* hack disabled... **/          
        } else {
          G_alzThemesX.push(key)  // add
          arrTab[row][6].css("font-style","italic");
        }
        //console.log("X: "+G_alzThemesX)
      }

    } else {  // highlight
      $('#msg').text("Select one or more themes to highlight specific values on map");
      $('#themes th').eq(4).show();
      $('#themes th').eq(5).show();
      $('#themes tr').each(function () {
        $(this).find('td').eq(4).show();
        $(this).find('td').eq(5).show();
        $(this).find('td').eq(6).show();
      });
      if (col == 4) {  // set draw
        //console.log("unset")
        if ($('#sethlitefilter').is(':visible')) {  // don't allow when other theme is being edited
          if ($(event.target).is('input')) {
            $(this).find('input').prop('checked', false); // don't allow check button
          } else {
            $(this).find('input').prop('checked', true);  // don't allow check outside button
          }          
          if (jQuery.inArray(key, G_hliteThemes) >= 0) {
            //console.log("unset 2")
            if ($(event.target).is('input')) {
              $(this).find('input').prop('checked', true); // don't allow check button
            } else {
              $(this).find('input').prop('checked', false);  // don't allow check outside button
            }            
          }
          $('#sethlite-btn').css("background-color","Cyan");
          return; 
        }
        if (jQuery.inArray(key, G_hliteThemes) !== -1) {
          arrTab[row][6].css("border-style","none");
          var i = jQuery.inArray(key, G_hliteThemes);          
          G_hliteThemes.splice(i, 1)  // remove
        } else {
          arrTab[row][6].css("border-style","solid");
          arrTab[row][6].css("border-color","White White White Cyan");
          // edit
          G_hliteThemes.push(key)
          if (!(key in G_hliteFilters)) {
            G_hliteFilters[key] = null;
            setHliteFilter(key);  // invoke dynamic input form
          }
        }
        if (!$('#sethlitefilter').is(':visible')) {
          refreshMap(null);
        }
      } else if (col == 5) {  // edit
        setHliteFilter(key);  // invoke dynamic input form
      }
      //console.log("Hlites: "+G_hliteThemes)
    }

  });  // themes td

  // http://stackoverflow.com/questions/24013062/jquery-toggle-checkbox-input-with-table-cell-click
  $('td').click(function (e) {
    if (!$(event.target).is('input')) {
      var obj = $(this).find('input');      
      obj.prop('checked', !obj.is(':checked'));      
    }
  });

  $('#sethlite-btn').click(function (e) {
    var key = $('#sethlitefilter').prop('class');
    var val1 = $('#sethlite-opt').prop('value');
    var val2 = $('#sethliteval').prop('value');
    //console.log(key+": Filter "+val1+val2)
    if (!(key === undefined || val1 === undefined || val2 === undefined)) {      
      G_hliteFilters[key] = val1+val2;
      refreshMap(null);
    }
    $('#sethlite-opt-lab').text("")
    $('#sethlite-btn').css("background-color","White");
    $('#sethlite-opt').hide();
    $('#sethlitefilter').hide();
  });
}

function setSlideInfo(p) {
  // share slider for both themeinfo and computeinfo
  if (p.fgdc_Title != undefined) {  // themeinfo
    /*
    "fgdc_Originator":"Transportation Injury Mapping System (TIMS)",
    "fgdc_Title":"Traffic collisons - Fatal/Severe involving Bicycle/Pedestrian (average year/sqkm)",
    "fgdc_Abstract":"Derived from California Statewide Integrated Traffic Records System (SWITRS)",
    "fgdc_Theme_Keyword":"",
    "fgdc_Online_Linkage":"http://tims.berkeley.edu/",
    "fgdc_Time_Period_of_Content":"2004-2013",
    "fgdc_Data_Set_Credit":"Safe Transportation Research and Education Center (SafeTREC) at the University of California, Berkeley"
      */
    $('#info').html('<p>'+p.fgdc_Title+'</p>');
    // prepare slide in
    $('#themeinfo-header').html('<h5>'+getThemeByKey(p.key, G_themes).name+'</h5><a href="#0" class="cd-panel-close">Close</a>');
    $('#themeinfo').html('<p> <strong>ID: </strong>'+p.key+'<br><strong>Type: </strong>'+p.type+'<br><strong>Source: </strong>'+p.fgdc_Originator+'<br>'+p.fgdc_Abstract+'<br><strong>Time Period: </strong>'+p.fgdc_Time_Period_of_Content+'<br><strong>Source Link: </strong><a href="'+p.fgdc_Online_Linkage+'" target="_blank">'+p.fgdc_Online_Linkage+'</a> <br><strong>Credit: </strong>'+p.fgdc_Data_Set_Credit+'  </p>');
  } else {  // computeinfo
    //console.log(p)
    var html, helpLink;
    var type = p[0];
    if (type == "cor") {      
      html = "<h5>Linear Correlation</h5>";
      helpLink = "http://stattrek.com/statistics/correlation.aspx";
    } else {  // reg      
      html = "<h5>Linear Regression</h5>";
      helpLink = "http://stattrek.com/regression/linear-regression.aspx";
    }
    $('#themeinfo-header').html('<h5>Analysis Results</h5><a href="#0" class="cd-panel-close">Close</a>');
    var i = 1;
    while (i<p.length) {
      //console.log(p[i]+': '+p[i+1])
      if (i == 1) {
        html = html + '<em><strong>'+p[i]+': </strong></em>'+p[i+1]
      } else {
        html = html + '<br><strong>'+p[i]+': </strong>'+p[i+1]
      }
      i = i + 2;  // [k1, v1, .. kn, vn]
    }
    $('#themeinfo').html('<p>'+html+'<br><br><em>Learn about Statistics: </em><a href="'+helpLink+'" target="_blank">'+helpLink+'</a> </p>');    
  }

}

function setHliteFilter(key) {
  if (!$('#sethlitefilter').is(':visible')) {
    $('#sethlite-opt').show();
    var themeProps = getThemeByKey(key, G_themeProps);
    $('#sethlite-opt-lab').text(getThemeByKey(key, G_themes).name+" ("+themeProps.units+")");
    var min = themeProps.min;
    var max = themeProps.max;
    var val = min;
    if (G_hliteFilters[key]) { 
      val = G_hliteFilters[key];   
      var op = val.substring(0,1);
      if (op == '=') {         
        val = G_hliteFilters[key].substring(2);  // first chars are "=="
        op = "=="
      } else {
        val = G_hliteFilters[key].substring(1);  // first char is ">|<"
      }
      $('#sethlite-opt').val(op).change()
    }    
    //console.log("Set: "+op+val)
    /*                                    use class as tag */
    $('#info').html('<div id="sethlitefilter" class="'+key+'">  <form><input type="range" name="amountRange" id="sethliteval" min="'+min+'" max="'+max+'" value="'+val+'" oninput="this.form.amountInput.value=this.value" /><input type="number" name="amountInput" min="'+min+'" max="'+max+'" value="'+val+'" oninput="this.form.amountRange.value=this.value" /></form> </div>');
    return true;
  } else {
    $('#sethlite-btn').css("background-color","Cyan");
    return false;
  }
}

function getThemeByKey(key, data) {
  var retVal = null;
  var p;
  for (var i=0; i<data.length; i++) {
      p = data[i];
      if (p.key == key) {
         retVal = p;
         break;
     } 
  }
  return retVal;
}

function setColorRange(color) {
//
// https://bl.ocks.org/mbostock/5577023

  var retVal = null;
  //console.log(color)
  switch (color) {
    case "Blues":
      retVal = colorbrewer.Blues[9];
      break;
    case "Greens":
      retVal = colorbrewer.Greens[9];
      break;
    case "OrRd":
      retVal = colorbrewer.OrRd[9];
      break;
    case "RdBu":
      retVal = colorbrewer.RdBu[9];
      break;
    case "RdPu":
      retVal = colorbrewer.RdPu[9];
      break;
    case "YlOrBr":
      retVal = colorbrewer.YlOrBr[9];
      break;
    case "Reds":
      retVal = colorbrewer.Reds[9];
      break;
    case "RdYlGn":
      retVal = colorbrewer.RdYlGn[9];
      break;
    case "Spectral":
      retVal = colorbrewer.Spectral[9];
      break;
    default:
      retVal = colorbrewer.Set3[12];
  }
  return retVal;
}

function refreshMap(e) { 
  var themes = G_hliteThemes.slice(0);  // clone array
  themes.unshift(G_mapTheme.key);       // add to beginning
  themes = d3.set(themes).values()      /* NOTE must keep item order - https://github.com/d3/d3/wiki/Arrays#set_values **/
  //console.log("Themes: "+themes)
  var style = G_mapTheme.style;

  // check if need for request
  if (e!==null) {  // Check on null to detect L_map.on("moveend", refresh) event 
    if (G_alzThemeY.length > 0) {
      $('#compute-div').css("background-color", "LightGray");
      G_alzResults['cor'] = [];
      G_alzResults['reg'] = [];
    }
    if (!($('#refresh').is(":checked"))) {
      return;
    }    
  } else if (style == "val") {  
    /* NOTE must maintain individual theme status for "Getis" in order to optimize style=="hot" **/
    var p = G_points[0];  // grab first point (if any)    
    if (p) { 
      var skip = true;
      for (var i=0; i<themes.length; i++) {
        if (p[themes[i]] === undefined) {
          skip = false;
          break;
        }
      }
      if (skip) {  
        //console.log("skip")        
        if (getThemeByKey(G_mapTheme.key, G_themeStats)) {
          var min, max;  // initially set = 0, -1
          min = getThemeByKey(G_mapTheme.key, G_themeStats).valStats.min;
          max = getThemeByKey(G_mapTheme.key, G_themeStats).valStats.max;
          if (max >= min) {
            G_mapTheme.draw(G_points, L_map, L_markerLayer);
            return;
          }
        }
      }
    }
  }
  
  var bnds = L_map.getBounds();  // NE, SW lat/lon
  var zoom = L_map.getZoom(); 
  if (style == "hot") {  // assumes map theme first in param list
    var i = jQuery.inArray(G_mapTheme.key, themes);
    if (i > 0) {
      themes.splice(i,1);  // remove 
      themes.unshift(G_mapTheme.key);  // add to beginning
    }
  }
  
  // request features via opencpu stateless
  $('#mapmsg').text("Requesting features...");
  $('.spinner_map').show();
  console.log("RPC: "+themes+" Zoom:"+zoom+" Style:"+style+" "+bnds._southWest.lng+","+bnds._southWest.lat+" "+bnds._northEast.lng+","+bnds._northEast.lat)
  var req = ocpu.rpc("getPoints", {
    sw : bnds._southWest,          
    ne : bnds._northEast,
    zoom : zoom,
    style: style,
    themes: themes    
  }, function(data) {  // retrieve the returned object async
    G_points = data[0];
    //console.log(G_points[0])    
    if (G_points) {  // not null       
      var stats = getThemeByKey(G_mapTheme.key, G_themeStats);
      if (!stats) {
        G_themeStats.push(new ThemeStats(G_mapTheme.key));
        stats = getThemeByKey(G_mapTheme.key, G_themeStats);  // default
      } 
      //console.log("min: "+data[1]+" avg: "+data[2]+" max: "+data[3])
      if (style == "val") {
        stats.valStats.min = data[1][0]; stats.valStats.avg = data[2][0]; stats.valStats.max = data[3][0];
      } else {  // hot
        stats.hotStats.min = data[1][0]; stats.hotStats.avg = data[2][0]; stats.hotStats.max = data[3][0];
      } 
      //console.log(stats)
      G_mapTheme.draw(G_points, L_map, L_markerLayer);
    } else {
      $("#mapmsg").text("0 points returned");      
    }    
  });
  req.fail(function() {
    alert("Server error: " + req.responseText);
  });
  req.always(function() {
    $('.spinner_map').hide();
  });
}

function runAnalysis(alztype) {  
  if (G_alzThemeY === null || G_alzThemesX.length < 1) {
    return;
  }
  var plot = $('#plot-chk').is(":checked");
  var themes = G_alzThemesX.slice(0);  // clone array
  themes.unshift(G_alzThemeY);         // add to beginning
  var bnds = L_map.getBounds();  // NE, SW lat/lon
  var zoom = L_map.getZoom();    
  
  // request features via opencpu stateful
  $("#compute_output1").text("Computing...");
  $("#compute-btn").prop('disabled', true);
  $('#compute-div').css("background-color", "White");
  $('#plot').css("background-color", "LightGray");
  console.log("CALL: "+themes+" Type:"+alztype+" Zoom:"+zoom+" "+bnds._southWest.lat+","+bnds._southWest.lng+" "+bnds._northEast.lat+","+bnds._northEast.lng)  
  var req1 = ocpu.call("compute", {
    sw : bnds._southWest,          
    ne : bnds._northEast,
    zoom : zoom,
    alztype: alztype,
    themes: themes
  }, function(session1) {  // retrieve the returned object async
    session1.getObject(function(df) {
      G_session = session1.getKey();
      if (df.length > 0) {  // chain calls operating on data frame 
        var call = alztype == "cor" ? "computeCor" : "computeReg";
        var req2 = ocpu.rpc(call, {
          df : session1
        }, function(data) {
          //console.log(data)
          var r = [];
          r.push("Independent variable (Y)");
          r.push(G_alzThemeY);
          r.push("Dependent variables (X)");
          r.push(G_alzThemesX);
          if (alztype == "cor") {  
            var k1 = data[0];
            var v1 = data[1];
            var v2 = Math.abs(v1 * 100);  // ignore negative (see plot)
            $('#compute_output1').html("r = "+parseFloat(v1).toFixed(2));
            if (G_alzThemesX.length > 1) {
              $('#compute_output1').html("Average r = "+parseFloat(v1).toFixed(2));
            }
            $('#compute_output1').prop('title', k1);
            $('#compute-slider').prop('value', v2);
            $('#compute-slider').prop('title', "-1 <= r <= 1");       
          } else {  // reg
            var k1 = data[0];
            var v1 = data[1];
            var v2 = Math.round(v1 * 100);
            $('#compute_output1').html("R<sup>2</sup>= "+v2.toFixed(0)+"%");
            $('#compute_output1').prop('title', "coefficient of determination (R-squared)");
            $('#compute-slider').prop('value', v2); 
            $('#compute-slider').prop('title', "0 <= R-squared <= 100");
          }
          document.getElementById('compute-slider').disabled = true;  // jQuery doesn't work here..
          $("#mapmsg").text(G_session);
          G_alzResults[alztype] = r.concat(data);
        });
        req2.fail(function() {
          alert("Server error: " + req3.responseText);
        }); 

        if (plot) {  
          $('#plot').show();
          $('#themes').hide();    
          $('#more').hide();
          if (alztype == "cor") {                
            var req3 = $("#plot").rplot("scatterPlot", {
              df : session1,
              y_lab : getThemeByKey(G_alzThemeY, G_themes).name,
              x_lab : getThemeByKey(G_alzThemesX[0], G_themes).name
            });
            req3.fail(function() {
              alert("Server error: " + req3.responseText);
            }); 
          } else {  // reg
            var req3 = $("#plot").rplot("residualPlot", {
              df : session1
            });
            req3.fail(function() {
              alert("Server error: " + req3.responseText);
            });
          }
        }
      } else {
        $("#compute_output1").text("No results returned");
      }      
    });    
  }); 
  req1.fail(function(){
    alert("Server error: " + req1.responseText);
  });
  req1.always(function(){
    $("#compute-btn").prop('disabled', false);
    $('#frame-left-bottom').css("background-color", "white");
  });
}

function drawLegend(stats, colorRange, style, values) {  
                    if (style === undefined) style = "val";
                    if (values === undefined) values = null;
// https://bl.ocks.org/mbostock/4573883  
  
  var width = 500,
    widthSF = 400,  // affects left/right margins...
    height = 90,
    formatPercent = d3.format(".0%"),
    formatNumber = d3.format(".0f");
  var mid = "";

  if (stats.type == "categorical") {
    // http://www.competa.com/blog/2015/07/d3-js-part-7-of-9-adding-a-legend-to-explain-the-data/
    var threshold = d3.scale.threshold()
      .domain([12, 22, 23, 30, 40, 51, 70, 81, 89, 100])       
      .range(["#80b1d3", "#fccde5", "#fdb462", "#fb8072", "#ffffb3", "#b3de69", "#ffed6f", "#ccebc5", "#bebada", "#bc80bd", "#8dd3c7"]);
    /* HARDCODED Land Cover ***/
    var key = d3.scale.ordinal() 
      .domain(["Water", "Developed Open", "Dev. Low Intensity", "Dev. Med/High Int.", "Barren Land", "Forest", "Shrub", "Grassland", "Pasture/Crops", "Wetlands"])
      .range(["#80b1d3", "#fccde5", "#fdb462", "#fb8072", "#ffffb3", "#b3de69", "#ffed6f", "#ccebc5", "#bebada", "#bc80bd", "#8dd3c7"]);

    var rectW = width / key.domain().length;
    var rectH = height / 3;
    var xOff = 0;
    var yOff = rectH / 1;
    d3.select("svg").remove();  // clear existing
    var svg = d3.select("#legend").append("svg")
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .selectAll("g")
      .data(key.domain())
      .enter()
      .append('g')
        .attr('class', 'legend')
        .attr('transform', function(d, i) {
          var x = xOff + i * rectW;
          var y = yOff;
          return 'translate(' + x + ',' + y + ')';
        });
    svg.append('rect')
      .attr('width', rectW)
      .attr('height', rectH)
      .style('fill', key);
    svg.append('text')
    .attr('x', 0)
    .attr('y', function(d, i) {
      return i % 2 * rectH * 1.25;})
    .text(function(d) {return d;});

      //$('#legend').css('visibility', 'hidden');  
  } else {     
    //$('#legend').css('visibility', 'visible'); 
    // threshold is for map symbols - https://github.com/mbostock/d3/wiki/Quantitative-Scales#quantize-scales
    if (stats.type == "continuous") {
      var threshold = d3.scale.quantize()  
        .range(colorRange)
        .domain([stats.min, stats.max]);
    } else {  // discrete
      var threshold = d3.scale.quantile()
        .range(colorRange)
        .domain([stats.min, stats.max]);
    }

    var x = d3.scale.linear()  // x axis
      .domain([stats.min, stats.max])
      .range([0, widthSF]);
    mid = Number(stats.min) + ((stats.max - stats.min) / 2);
    var xAxis = d3.svg.axis()
      .scale(x)
      .tickValues([stats.min, mid, stats.max])
      .orient("top");

    d3.select("svg").remove();  // clear existing
    var svg = d3.select("#legend").append("svg")
      .attr("width", width)
      .attr("height", height);
    var g = svg.append("g")
      .attr("class", "key")
      .attr("transform", "translate(" + (width - widthSF) / 2 + "," + height / 3 + ")");

    g.selectAll("rect")
      .data(threshold.range().map(function(color) {         
        var d = threshold.invertExtent(color);        
        if (d[0] == null) d[0] = x.domain()[0];
        if (d[1] == null) d[1] = x.domain()[1];
        return d;
      }))
      .enter().append("rect")
        .attr("height", 20)
        .attr("x", function(d) { return x(d[0]); })
        .attr("width", function(d) { return x(d[1]) - x(d[0]); })
        .style("fill", function(d) { return threshold(d[0]); });
    g.call(xAxis); 
    g.call(xAxis).append("text")
      .attr("class", "caption")
      .attr("y", 15)
      .attr("x", x(stats.max) + 5)
      .attr("text-anchor", "left")
      .text(stats.units);
    
    // average tick on separate axis
    var g2 = svg.append("g")
      .attr("class", "key")
      .attr("transform", "translate(" + (width - widthSF) / 2 + "," + height / 3 + ")");
    var xAxis2 = d3.svg.axis()
      .scale(x)
      .tickValues([stats.avg])
      .orient("bottom");
    g2.call(xAxis2);
    g2.call(xAxis2).append("text")
      .attr("class", "caption")
      .attr("y", 30)
      .attr("x", x(stats.avg))
      .attr("text-anchor", "middle")
      .text("Average");  
  }
  return threshold;
}


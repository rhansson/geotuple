#
#   Copyright (c) 2015 Roland Hansson - Nova Spatial LLC. All
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.

# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.

# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.

# library(opencpu)
# opencpu$stop()
# opencpu$start(9069)
# opencpu$browse("/library/geotuple/www/index.html")
# library(RPostgreSQL)
# library(spdep)
#
# .Rprofile in HOMEPATH
# Sys.getenv('HOME')

#-----------------------------------------------------------------
init <- function(v="MB_TOKEN") {
  return(eval(parse(text=v)))
}

#-----------------------------------------------------------------
getPoints <- function (sw, ne, zoom=14, style="val", themes="z") {
  # getPoints( c(33.743,-117.81), c(33.75,-117.79), "15")
  # getPoints( c(33.743,-117.81), c(33.75,-117.79), "15", "hot", list("z"))
  # getPoints( c(33.743,-117.81), c(33.75,-117.79), "15", "val", list("z","landcov"))
  # getPoints( c(33.743,-117.81), c(33.75,-117.79), "15", "hot", list("z","landcov"))
  data <- list()
  #ptm <- proc.time()  # Start timing

  # load data frame
  if (length(themes) > 0) {
    df <- queryDbPoints(sw, ne, zoom, themes)
  }
  if (length(df) > 1) {
    if (style=="hot") {
      df <- hotSpot(df)
      data <- list(df, min(df$Getis,na.rm=T), mean(df$Getis,na.rm=T), max(df$Getis,na.rm=T))
    } else {  # col value
      data <- list(df, min(df[,3],na.rm=T), mean(df[,3],na.rm=T), max(df[,3],na.rm=T))
    }
  }
  #print(proc.time() - ptm)  # Stop timing
  return(data)
}

#-----------------------------------------------------------------
queryDbPoints <- function(sw, ne, zoom, themes) {
  df = NULL

  # build dynamic query
  xmin <- sw[2]
  ymin <- sw[1]
  xmax <- ne[2]
  ymax <- ne[1]
  cols <- paste(themes, collapse=',')
  if (length(themes)>1) {
    themesl <- paste(themes, collapse=' numeric, ')
    themesl <- paste(themesl,"numeric")
  } else {
    themesl <- paste(themes,"numeric")
  }
  defs <- paste("AS (x float, y float,", themesl)
  key <- paste("'",GT_KEY,"'", sep = "")

  # create a connection to the postgres database
  con <- getPgCon()

  # query for features in bnds
  tab <- "grid"
  if (dbExistsTable(con, tab)) {
    q <- paste("SELECT * FROM gt_selectgridx(", xmin,",",ymin,",",xmax,",",ymax,",",zoom,",'{", cols,"}',",key,")", defs,");")
    #print(q)
    df <- dbGetQuery(con, q)
  }
  dbDisconnect(con)
  return(df)
}

#-----------------------------------------------------------------
hotSpot <-function(df) {
  #
  # http://www.maths.lancs.ac.uk/~rowlings/Teaching/UseR2012/cheatsheet.html
  require(spdep)

  xy <- df[,c(1,2)]
  val <- df[c(3)]
  col = colnames(df[3])  # first theme is target
  spdf <- SpatialPointsDataFrame(coords=xy, data=val, proj4string = CRS("+proj=longlat +datum=WGS84 +ellps=WGS84 +towgs84=0,0,0"))
  #View(spdf)
  kn <- knearneigh(spdf, k=4)
  kn <- knn2nb(kn)  # convert to nb object
  # Test Local Getis Ord G
  G <- localG(spdf@data[ , col ], listw=nb2listw(kn), zero.policy=TRUE)
  # append the Z-scores back to the points
  spdf@data$Getis <- G[1:length(G)]
  df2 <- merge(df, as.data.frame(spdf))  # append to original
  #View(df2)
  return(df2)
}

#-----------------------------------------------------------------
compute <- function (sw, ne, zoom=14, alztype="cor", themes=NULL) {
  # df1 <- compute( c(33.743,-117.81), c(33.75,-117.79), "15", "cor", list("z", "landcov"))
  # df1 <- compute( c(33.743,-117.81), c(33.75,-117.79), "15", "cor", list("z", "landcov", "dist_mroad"))
  # NOTE: step 1
  df = list()

  # load data frame for subsequent analysis
  if (length(themes) > 1) {
    pts <- queryDbPoints(sw, ne, zoom, themes)
    if (length(pts)>1) {
      df <- pts
    }
  }
  return(df)
}

#-----------------------------------------------------------------
computeCor <- function(df) {
  # Correlation
  # computeCor(df1)
  # NOTE: step 2
  # assumes [x, y, theme1, theme2, .. n]
  data <- list()
  numCols <- ncol(df)
  if (numCols < 5) {
    Test <- cor.test(df[,c(3)], df[,c(4)], method="pearson", na.action="na.exclude")
    #print(Test)
    #str(Test)
    m  <- Test$method
    n  <- Test$parameter[1]
    cc <- Test$estimate
    pv <- Test$p.value
    ci1 <- Test$conf.int[1]
    ci2 <- Test$conf.int[2]
    data <- list("Correlation coefficient (r)", round(cc, digits=3), "Method", m, "Degrees of freedom", n, "p-value", round(pv, digits=6),
                 "95 percent confidence interval (1)", ci1, "95 percent confidence interval (2)", ci2)
  } else {
    yCols <- colnames(df[,c(4:numCols)])
    Cor <- round(cor(df[,c(3:4)], use="pairwise.complete.obs", method="pearson"), digits=3)
    cc <- Cor[2]
    avg <- abs(c(cc))
    yVals <- c(cc)
    yAbs <- c(avg)
    for (i in 5:numCols) {  # all but x, y, theme1
      Cor <- cor(df[,c(3,i)], use="pairwise.complete.obs", method="pearson")
      cc <- round(Cor, digits=3)[2]
      avg <- c(avg, abs(cc))
      yVals <- c(yVals, cc)
      yAbs <- c(yAbs, abs(cc))
    }
    dfY <-data.frame(col=yCols, val=yVals, abs=yAbs)
    avgCC <- (mean(dfY[["abs"]]))
    #print(dfY)
    # sort by absolute values so we can returned a ranked list of themes
    dfYsort <- dfY[with(dfY, order(-abs)),]
    #print(dfYsort)
    data <- list("Mean correlation coeff. (r)", round(avgCC, digits=3), "Variables by rank", dfYsort[["col"]], "Corr. coeffs. by rank", dfYsort[["val"]])
  }
  return(data)
}

#-----------------------------------------------------------------
computeReg <- function(df) {
  # Regression
  # computeReg(df1)
  # NOTE: step 2
  # assumes [x, y, theme1-Y, theme2-X1, .. theme-Xn]
  data <- list()
  xvar <- colnames(df)[3]
  ycols <- colnames(df[-1:-3])  # all but x, y
  yvars <- paste(ycols, collapse="+")
  frm <- formula(paste(xvar,"~",yvars))
  LM.model = lm(frm, data=df)
  #print(summary(LM.model))
  sumLM <- summary(LM.model)
  #str(sumLM)
  r2 <- sumLM$r.squared
  ar2 <- sumLM$adj.r.squared
  se <- sumLM$coefficients[2]
  fs <- sumLM$fstatistic[1]
  n <- sumLM$fstatistic[3]
  pv <- anova(LM.model)$'Pr(>F)'[1]
  data <- list("Coefficient of determination (R-squared)", round(r2, digits=3), "Adjusted R-squared", round(ar2, digits=3),
               "Standard Error", round(se, digits=3), "F-Statistic", round(fs, digits=3), "Degrees of freedom", n, "p-value", round(pv, digits=6) )
  return(data)
}

#-----------------------------------------------------------------
scatterPlot <- function(df, x_lab=NULL, y_lab=NULL) {
  # assumes [x, y, theme1-Y, theme2-X1, .. theme-Xn]
  if (ncol(df) < 5) {
    xvar <- colnames(df)[3]
    yvar <- colnames(df)[4]
    if (length(x_lab) < 1) {x_lab = xvar}
    if (length(y_lab) < 1) {y_lab = yvar}
    frm <- formula(paste(xvar,"~",yvar))
    LM.model = lm(frm, data=df)
    #print(summary(LM.model))
    rsq <- summary(LM.model)$r.squared
    plot(frm, data=df, pch=20, xlab=x_lab, ylab=y_lab)
    abline(LM.model, col="red")  # Draws the regression line on the plot
  } else {
    # NOTE abline - http://stackoverflow.com/questions/17615791/plot-regression-line-from-multiple-regression-in-r
    plot(df[-1:-2], pch=20)  # all but x, y
  }
}

#-----------------------------------------------------------------
residualPlot <- function(df) {
  # assumes [x, y, theme1-Y, theme2-X1, .. theme-Xn]
  xvar <- colnames(df)[3]
  ycols <- colnames(df[-1:-3])  # all but x, y, theme1
  yvars <- paste(ycols, collapse="+")
  frm <- formula(paste(xvar,"~",yvars))
  LM.model = lm(frm, data=df)
  par(mfrow=c(2,2))
  plot(LM.model, pch=20)
}

#-----------------------------------------------------------------
getPgCon <- function(db=PG_DB){
  require(RPostgreSQL)
  return(dbConnect(PostgreSQL(),
                   host="localhost",
                   port=PG_PORT,
                   user=PG_USER,
                   password=PG_PASSW,
                   dbname=db))
}

#-----------------------------------------------------------------
getThemes <- function(themes='*') {
  df = NULL

  # create a connection to the postgres database
  con <- getPgCon()

  # query for themes
  tab <- "theme"
  if (dbExistsTable(con, tab)) {
    q <- paste("SELECT array_agg(name ORDER BY theme_id) AS themes FROM theme;")
    #print(q)
    df <- dbGetQuery(con, q)
  }
  dbDisconnect(con)
  return(df)
}

#-----------------------------------------------------------------
api_getpoints <- function(sw_lon, sw_lat, ne_lon, ne_lat, zoom=7, themes='z', key=0) {
  #                                                                                                 Sacramento:   -121.552 38.543 -121.44 38.61
  # curl http://localhost:9069/ocpu/library/geotuple/R/api_getpoints/json -H "Content-Type: application/json" -d '{"sw_lon":"-117.222", "sw_lat":"34.026", "ne_lon":"-117.166", "ne_lat":"34.062", "zoom":"11", "themes":"z", "key":"API_KEY"}'
  # curl http://localhost:9069/ocpu/library/geotuple/R/api_getpoints/json -H "Content-Type: application/json" -d '{"sw_lon":"-117.222", "sw_lat":"34.026", "ne_lon":"-117.166", "ne_lat":"34.062", "zoom":"12", "themes":["landcov", "dist_mroad"], "key":"API_KEY"}'
  #
  df = NULL

  # build dynamic query
  cols <- paste(themes, collapse=',')
  if (length(themes)>1) {
    themesl <- paste(themes, collapse=' numeric, ')
    themesl <- paste(themesl,"numeric")
  } else {
    themesl <- paste(themes,"numeric")
  }
  #print(themesl)
  defs <- paste("AS (x float, y float,", themesl)
  key <- paste("'", key,"'", sep = "")

  # create a connection to the postgres database
  con <- getPgCon()

  # query for feature closest to lon/lat
  tab <- "grid"
  if (dbExistsTable(con, tab)) {
    q <- paste("SELECT * FROM gt_api_getpoints(", sw_lon,",",sw_lat,",",ne_lon,",",ne_lat,",", zoom,",'{", cols,"}',",key,")", defs,");")
    #print(q)
    df <- dbGetQuery(con, q)
  }
  dbDisconnect(con)
  return(df)
}

#-----------------------------------------------------------------
api_getpoint <- function(lon, lat, themes='z', key=0) {
  #
  # curl http://localhost:9069/ocpu/library/geotuple/R/api_getpoint/json -H "Content-Type: application/json" -d '{"lon":"-117.198", "lat":"34.0402", "themes":"z", "key":"API_KEY"}'
  # curl http://localhost:9069/ocpu/library/geotuple/R/api_getpoint/json -H "Content-Type: application/json" -d '{"lon":"-117.198", "lat":"34.0402", "themes":["landcov", "dist_mroad"], "key":"API_KEY"}'
  # curl http://localhost:9069/ocpu/library/geotuple/R/api_getpoint/json -H "Content-Type: application/json" -d '{"lon":"-117.198", "lat":"34.0402", "themes":"*", "key":"API_KEY"}'
  #
  df = NULL

  # build dynamic query
  cols <- paste(themes, collapse=',')
  if (length(themes)>1) {
    themesl <- paste(themes, collapse=' numeric, ')
    themesl <- paste(themesl,"numeric")
  } else {
    if (themes=="*") {
      themes <- getThemes()
      themes <- substr(themes, 2 , nchar(themes) - 1)  # trim {..}
      themes <- strsplit(themes, ",")
      themesl <- list()
      for (w in themes) {
        themesl <- c(themesl, w)
      }
      themesl <- paste(themesl, collapse=' numeric, ')
      themesl <- paste(themesl,"numeric")
    } else {
      themesl <- paste(themes,"numeric")
    }
  }
  #print(themesl)
  defs <- paste("AS (dist int,", themesl)
  key <- paste("'",GT_KEY,"'", sep = "")

  # create a connection to the postgres database
  con <- getPgCon()

  # query for feature closest to lon/lat
  tab <- "grid"
  if (dbExistsTable(con, tab)) {
    q <- paste("SELECT * FROM gt_api_getpoint(", lon,",",lat,",'{", cols,"}',",key,")", defs,");")
    #print(q)
    df <- dbGetQuery(con, q)
  }
  dbDisconnect(con)
  return(df)
}

#-----------------------------------------------------------------
api_getthemes <- function(themes='*', key=0) {
  #
  # curl http://localhost:9069/ocpu/library/geotuple/R/api_getthemes/json -H "Content-Type: application/json" -d '{"themes":"*"}'
  #
  df = NULL

  # create a connection to the postgres database
  con <- getPgCon()

  # query for themes
  tab <- "theme"
  if (dbExistsTable(con, tab)) {
    #q <- paste("SELECT array_agg(name ORDER BY theme_id) AS themes FROM theme;")
    q <- paste("SELECT name, descr FROM theme ORDER BY theme_id;")
    #print(q)
    df <- dbGetQuery(con, q)
  }
  dbDisconnect(con)
  return(df)
}

#-----------------------------------------------------------------
api_getthemeprops <- function(theme) {
  #
  # curl http://localhost:9069/ocpu/library/geotuple/R/api_getthemeprops/json -H "Content-Type: application/json" -d '{"theme":"z"}'
  #
  df = NULL

  # create a connection to the postgres database
  con <- getPgCon()

  # query for theme properties
  tab <- "themestat"
  if (dbExistsTable(con, tab)) {
    #q <- paste("SELECT descr, type, units, is_dist, min, max, avg FROM theme t INNER JOIN themestat ts ON ts.theme_id = t.theme_id WHERE t.name = 'z';")
    q <- paste("SELECT descr, type, units, is_dist, min, max, avg FROM theme t INNER JOIN themestat ts ON ts.theme_id = t.theme_id WHERE t.name = ")
    q <- paste(q, "'", theme, "';", sep = "")
    #print(q)
    df <- dbGetQuery(con, q)
  }
  dbDisconnect(con)
  return(df)
}

#-----------------------------------------------------------------
getKey <-function (x="") {
  return("Generating key...")  # the purpose is to just create a session
}

#-----------------------------------------------------------------
addKey <- function(key="") {
  #
  df = NULL

  # create a connection to the postgres database
  con <- getPgCon()

  if (isSession(key)) {
    q <- paste("select gt_addkey('", key, "', '", GT_KEY, "');", sep = "")
    #print(q)
    x <- dbGetQuery(con, q)
    if (!is.null(x)) {
      df <- x
    }
  }
  dbDisconnect(con)
  return(df)
}

#-----------------------------------------------------------------
isSession <-function (key="") {
  # hardcoded path
  f <- paste("/tmp/ocpu-www-data/tmp_library/", sep="", key)
  #f <- "/usr/local"
  return((file.exists(f)))
}

#-----------------------------------------------------------------
test <-function (x="") {
  print("test")
  list(message = paste(x, " ", R.Version()$version.string))
}


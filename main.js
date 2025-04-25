import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

d3.csv("energy-consumption-by-source.csv", d3.autoType).then((csv) => {
  const data = processData(csv);
  const series = d3
    .stack()
    .offset(d3.stackOffsetExpand)
    .keys(d3.union(data.map((d) => d.key)))
    .value(([, D], key) => D.get(key).value)(
    d3.index(
      data,
      (d) => d.date,
      (d) => d.key
    )
  );
  const dates = Array.from(d3.union(data.map((d) => d.date)));
  console.log(series);

  let width,
    chipHeight,
    activeIndex = dates.length - 1;
  const height = 680;
  const marginTop = 20;
  const marginRight = 144;
  const marginBottom = 24;
  const marginLeft = 44;

  const svg = d3.select("#chart").on("mousemove touchmove", moved);
  const keyTooltip = d3.select("#keyTooltip");
  const valueTooltip = d3.select("#valueTooltip");

  const x = d3.scaleLinear().domain(d3.extent(dates));

  const y = d3.scaleLinear().range([height - marginBottom, marginTop]);

  const color = d3
    .scaleOrdinal()
    .domain(series.map((d) => d.key))
    .range(
      series.map(
        (d) => `var(--color-${d.key.toLowerCase().replaceAll(" ", "-")})`
      )
    );

  const area = d3
    .area()
    .x((d) => x(d.data[0]))
    .y0((d) => y(d[0]))
    .y1((d) => y(d[1]));

  const seriesPath = svg
    .append("g")
    .attr("class", "series")
    .selectChildren()
    .data(series)
    .join("path")
    .attr("class", "series-path")
    .attr("fill", (d) => color(d.key));

  const xAxisG = svg
    .append("g")
    .attr("class", "x axis")
    .attr("transform", `translate(0,${height - marginBottom})`);

  const yAxisG = svg
    .append("g")
    .attr("class", "y axis")
    .attr("transform", `translate(${marginLeft},0)`);

  const dateG = svg.append("g").attr("class", "date");
  dateG
    .append("line")
    .attr("class", "date-line")
    .attr("y1", marginTop - 4)
    .attr("y2", height - marginBottom + 4);
  const dateText = dateG
    .append("text")
    .attr("fill", "currentColor")
    .attr("text-anchor", "middle")
    .attr("y", marginTop - 8);

  const tooltipKeyChip = keyTooltip.selectChildren().data(series).join("div");

  const tooltipValueChip = valueTooltip
    .selectChildren()
    .data(series)
    .join("div");

  new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      resized(entry.contentRect);
    });
  }).observe(svg.node());

  function resized(contentBox) {
    if (width === contentBox.width) return;
    width = contentBox.width;

    chipHeight = keyTooltip.selectChild().node().getBoundingClientRect().height;

    x.range([marginLeft, width - marginRight]);

    svg.attr("viewBox", [0, 0, width, height]);

    render();
    renderActive();
  }

  function moved(event) {
    const [mx] = d3.pointer(event, this);
    const date = x.invert(mx);
    const index = d3.bisectCenter(dates, date);
    if (activeIndex !== index) {
      activeIndex = index;
      renderActive();
    }
  }

  function render() {
    seriesPath.attr("d", area);

    xAxisG.call(
      d3
        .axisBottom(x)
        .ticks((width - marginLeft - marginRight) / 100)
        .tickFormat(d3.format("d"))
        .tickPadding(8)
        .tickSize(-(height - marginTop - marginBottom))
    );

    yAxisG.call(
      d3
        .axisLeft(y)
        .ticks((height - marginTop - marginBottom) / 100)
        .tickFormat(d3.format(".0%"))
        .tickPadding(8)
        .tickSize(-(width - marginLeft - marginRight))
    );
  }

  function renderActive() {
    const ys = series.map((d) => y(d3.mean(d[activeIndex])));

    const radius = chipHeight / 2 + 2;
    const occludedYs = occlusionY(ys, radius);

    const tx = x(dates[activeIndex]);
    dateG.attr("transform", `translate(${tx},0)`);
    dateText.text(dates[activeIndex]);
    tooltipKeyChip.style(
      "transform",
      (d, i) => `translate(${tx + 1}px,calc(${occludedYs[i]}px - 50%))`
    );
    tooltipValueChip
      .style(
        "transform",
        (d, i) =>
          `translate(calc(${tx + -1}px - 100%),calc(${occludedYs[i]}px - 50%))`
      )
      .text((d) => {
        const v = d[activeIndex].data[1].get(d.key).value;
        if (v === 0) return "0.00%";
        if (v < 0.01) return "<0.01%";
        return v.toFixed(2) + "%";
      });
  }
});

function occlusionY(ys, radius) {
  const nodes = ys.map((y) => ({
    fx: 0,
    y,
  }));
  d3.forceSimulation(nodes)
    .force(
      "y",
      d3.forceY(({ y }) => y)
    )
    .force("collide", d3.forceCollide().radius(radius).iterations(2))
    .stop()
    .tick(20);
  return nodes.map(({ y }) => y);
}

function processData(csv) {
  const keys = [
    "Hydro",
    "Wind",
    "Solar",
    "Biofuels",
    "Other renewables",
    "Nuclear",
    "Gas",
    "Coal",
    "Oil",
  ];
  const data = csv.flatMap((d) =>
    keys.map((key) => ({
      date: d["Year"],
      key,
      value: d[`${key} - %`],
    }))
  );
  return data;
}

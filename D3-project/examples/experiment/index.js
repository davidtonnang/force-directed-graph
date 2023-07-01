// Fetch the JSON data
fetch("../datasets/co_data_test.json")
  .then((res) => res.json())
  .then((data) => {
    const therapyAreas = [
      ...new Set(data.nodes.map((node) => node.therapy_areas)),
    ]

    const filterDropdown = d3.select("#filterDropdown")

    const privateCheckbox = d3.select("#privateCheckbox")
    const publicCheckbox = d3.select("#publicCheckbox")
    const employeeRange = document.getElementById("employeeRange")


    privateCheckbox.on("change", handleFilterSelection)
    publicCheckbox.on("change", handleFilterSelection)

    filterDropdown
      .selectAll("option")
      .data(therapyAreas)
      .enter()
      .append("option")
      .attr("value", (d) => d)
      .text((d) => d)

    filterDropdown.on("change", handleFilterDropdown)

    // Initialize filterState
let filterState = {
  therapyArea: "",
  financing: {
    private: false,
    listed: false,
  },
  minEmployees: 0,
};

// Function to apply filters
function applyFilters() {
  // Use the filterState to filter nodes
  nodes
    .attr("r", (d) => {
      // Adjust radius based on filters
      let radius = d.size;
      if (filterState.therapyArea !== "" && d.therapy_areas.includes(filterState.therapyArea)) {
        radius *= 1.0;
      }
      if ((!filterState.financing.private && !filterState.financing.public) 
          || (filterState.financing.private && d.financing === "Private") 
          || (filterState.financing.public && d.financing === "Listed")) {
        radius *= 1.0;
      }
      if (d.amount_of_employees >= filterState.minEmployees) {
        radius *= 1.0;
      }
      return radius;
    })
    .style("opacity", (d) => {
      // Adjust opacity based on filters
      let opacity = 1;
      if (filterState.therapyArea !== "" && !d.therapy_areas.includes(filterState.therapyArea)) {
        opacity = 0.2;
      }
      if ((filterState.financing.private || filterState.financing.public) 
          && !(filterState.financing.private && d.financing === "Private") 
          && !(filterState.financing.public && d.financing === "Listed")) {
        opacity = 0.2;
      }
      if (!(d.amount_of_employees >= filterState.minEmployees)) {
        opacity = 0.2;
      }
      return opacity;
    });
}


// Handle therapy area filter
function handleFilterDropdown() {
  filterState.therapyArea = this.value;
  applyFilters();
}

// Handle financing filter
function handleFilterSelection() {
  filterState.financing.private = privateCheckbox.property("checked");
  filterState.financing.public = publicCheckbox.property("checked");
  applyFilters();

  privateCheckbox.on("change", function() {
    if (this.checked) {
      publicCheckbox.property("checked", false);
    }
    handleFilterSelection.call(this);
  })
  
  publicCheckbox.on("change", function() {
    if (this.checked) {
      privateCheckbox.property("checked", false);
    }
    handleFilterSelection.call(this);
  })
}

// Handle employee range filter
function handleEmployeeRangeSelection() {
  filterState.minEmployees = Math.pow(2, employeeRange.value);
  // update displayed value
  d3.select("#employeeValue").text(filterState.minEmployees);
  applyFilters();
}

// Attach event handlers to filters
filterDropdown.on("change", handleFilterDropdown);
privateCheckbox.on("change", handleFilterSelection);
publicCheckbox.on("change", handleFilterSelection);
employeeRange.addEventListener("input", handleEmployeeRangeSelection);


    

    // Create a function that links two nodes
    const DEFAULT_DISTANCE = 50
    const connectNodes = (source, target) => {
      data.links.push({
        source,
        target,
        distance: DEFAULT_DISTANCE,
      })
    }

    // Connect all the nodes to their Ecosystem node
    for (let i = 0; i < data.nodes.length; i++) {
      connectNodes(data.nodes[i].id, data.nodes[i].ecosystem)
    }

    // Set size depending on type of node
    for (let i = 0; i < data.nodes.length; i++) {
      if (data.nodes[i].size_in_visualisation == "big") {
        data.nodes[i].size = 30
      } else {
        data.nodes[i].size = 6
      }
    }

    // Manually connect the big nodes
    connectNodes("GoCo", "BioVentureHub")

    // Create the SVG container
    const svg = d3.select("#graph")

    // Create a group for the graph elements

    const container = svg.append("g")

    // Enable zooming and panning behavior
    const zoom = d3.zoom().on("zoom", (event) => {
      container.attr("transform", event.transform)
    })
    svg.call(zoom)

    // Create the force simulation
    const simulation = d3
      .forceSimulation(data.nodes)
      .force(
        "link",
        d3.forceLink(data.links).id((d) => d.id)
      )
      .force("charge", d3.forceManyBody().strength(-100))
      .force(
        "center",
        d3.forceCenter(
          svg.node().width.baseVal.value / 2,
          svg.node().height.baseVal.value / 2
        )
      )

    // Create the links
    const links = container
      .selectAll(".link")
      .data(data.links)
      .enter()
      .append("line")
      .attr("class", "link")
      .style("stroke", "rgba(255, 255, 255, 1)") // Set the color of the links

    // Create the nodes
    const nodes = container
      .selectAll(".node")
      .data(data.nodes)
      .enter()
      .append("circle")
      .attr("class", "node")
      .style("cursor", "pointer")
      .attr("r", (node) => node.size)

    // Create the labels for all nodes
    const labels = svg
      .selectAll(".label")
      .data(data.nodes)
      .enter()
      .append("text")
      .attr("class", "label")
      .text((d) => d.id)
      .style("fill", "white")
      .style("visibility", "hidden")

    // Update the label text on mouseover
    nodes
      .on("mouseover", function (event, d) {
        // Calculate the scaled coordinates relative to the current zoom level and the node's position
        const transform = d3.zoomTransform(svg.node())
        const scaledX = d.x * transform.k + transform.x
        const scaledY = d.y * transform.k + transform.y

        

        // Creates a new label
    const label = svg
    .append("text")
    .data([d])
    .attr("class", "label")
    .html((labelData) =>
      `<tspan>${labelData.id}</tspan>` +
      (labelData.amount_of_employees ? `<tspan x="0" dy="1.2em">Employees: ${labelData.amount_of_employees}</tspan>` : '') +
      `<tspan x="0" dy="1.2em">Therapy Area: ${labelData.therapy_areas}</tspan>` +
      (labelData.financing ? `<tspan x="0" dy="1.2em">Financing: ${labelData.financing}</tspan>` : '')
    )
    .style("visibility", "visible")
    .style("fill", "white")
    .attr("x", scaledX)
    .attr("y", scaledY - 10) // Adjust the y position to position the label above the node

        label
          .selectAll("tspan")
          .attr("x", scaledX + 15)
          .attr("dy", "1.2em")
      })
      nodes
  .on("mouseover", function (event, d) {
    const transform = d3.zoomTransform(svg.node())
    const scaledX = d.x * transform.k + transform.x
    const scaledY = d.y * transform.k + transform.y

    // Create a group to hold the foreignObject and label
    const labelGroup = svg.append("g").attr("class", "labelGroup")

    // Append a foreignObject to the group
    const foreignObject = labelGroup
      .append("foreignObject")
      .attr("x", scaledX + 15) // adjust position
      .attr("y", scaledY - 50) // adjust position
      .attr("width", 200) // set width
      .attr("height", 200) // set height
      .html(
        `<div class="info-box info-box-hidden">
           <h4>${d.id}</h4>
           <p>${d.amount_of_employees ? `Employees: ${d.amount_of_employees}` : ''}</p>
           <p>${d.therapy_areas ? `Therapy Area: ${d.therapy_areas}` : ''}</p>
           <p>${d.financing ? `Financing: ${d.financing}` : ''}</p>
         </div>`
      )

      setTimeout(() => {
        document.querySelector('.info-box').classList.remove('info-box-hidden');
      }, 10);
      
  })
  .on("mouseout", function (event, d) {
    svg.selectAll(".labelGroup").remove() // remove group on mouseout
  })


      // Adds a smooth zoom function on click for the nodes
      .on("click", function (event, d) {
        event.stopPropagation()
        const dx = d.x,
          dy = d.y,
          scale = 1.7 // affects the zoom level
        const translate = [
          svg.node().width.baseVal.value / 2 - scale * dx,
          svg.node().height.baseVal.value / 2 - scale * dy,
        ]

        svg
          .transition()
          .duration(3000) // Transition duration here, 3000 is 3 seconds
          .call(
            zoom.transform,
            d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
          )
      })

    // Updates the node and link positions on each tick of the simulation
    simulation.on("tick", () => {
      links
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y)

      nodes.attr("cx", (d) => d.x).attr("cy", (d) => d.y)

      labels.attr("x", (d) => d.x + 10).attr("y", (d) => d.y - 10)
    })
  })

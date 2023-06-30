// Fetch the JSON data
fetch("../datasets/co_data.json")
  .then((res) => res.json())
  .then((data) => {
    const therapyAreas = [
      ...new Set(data.nodes.map((node) => node.therapy_areas)),
    ]

    const filterDropdown = d3.select("#filterDropdown")

    const privateCheckbox = d3.select("#privateCheckbox")
    const publicCheckbox = d3.select("#publicCheckbox")

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

    function handleFilterDropdown() {
      const selectedArea = this.value

      nodes
        .attr("r", (d) => {
          if (selectedArea === "") {
            return 6 // Revert to the default node size when "All Therapy Areas" is selected
          } else {
            return d.therapy_areas.includes(selectedArea) ? 9 : 6
          }
        })
        .style("opacity", (d) => {
          
        const therapyMatch = selectedArea === "" || d.therapy_areas.includes(selectedArea);

        if (therapyMatch) {
              return 1 // Nodes with matching therapy area get highlighted
            } else {
              return 0.4 // Nodes that do not match the therapy area get put to the background
            }
    })
  }

    function handleFilterSelection() {
      const selectedArea = this.value // Get the selected therapy area
      const privateChecked = privateCheckbox.property("checked") // Check if private checkbox is checked
      const publicChecked = publicCheckbox.property("checked") // Check if public checkbox is checked

      // Update the node sizes based on the filter selection
      nodes.attr("r", (d) => {
        if (privateChecked && d.financing === "Private") { // Check if private checkbox is checked and node is private
          return 9;
        } else if (publicChecked && d.financing === "Listed") { // Check if public checkbox is checked and node is public
          return 9;
        } else {
          return 6; // Revert to the default node size when no checkbox is selected or node doesn't match
        }
      })

            // Checks for private and public financing to highlight nodes matching the private or public checkboxes
            .each(function(d) {
              const node = d3.select(this);
              const therapyMatch = selectedArea === "" || d.therapy_areas.includes(selectedArea);
              const privateMatch = !privateChecked || d.financing === "Private";
              const publicMatch = !publicChecked || d.financing === "Listed";
              console.log("Running") 

              // Vi behöver separera dropDown menyn och public / private för det förstör dropDown menyn just nu
            
              if (privateMatch && publicMatch) {
                node.style("opacity", 1); // Nodes with matching therapy area, "Private" financing, and "Public" financing
              } 
              
              else {
                node.style("opacity", 0.4); // Nodes that do not match the filter criteria
              }
            });
    }

   
    // Add the slider filter
    const employeeRange = document.getElementById("employeeRange")
    const employeeValue = document.getElementById("employeeValue")
    employeeValue.textContent = employeeRange.value // Display initial value

    employeeRange.addEventListener("input", handleEmployeeRangeSelection)

    function handleEmployeeRangeSelection() {
      const minEmployees = Math.pow(2, employeeRange.value) // Minimum number of employees
      employeeValue.textContent = minEmployees // Update displayed value

      // Update the node sizes and opacity based on the employee range
      nodes
        .attr("r", (d) => {
          if (minEmployees === 1) {
            return 6 // Revert to the default node size when the minimum employees is 0
          } else {
            return d.amount_of_employees >= minEmployees ? 6 : 6
          }
        })
        .style("opacity", (d) =>
          minEmployees === 0 || d.amount_of_employees >= minEmployees ? 1 : 0.5
        )
    }

    // Create the SVG container
    const svg = d3.select("#graph")
    
    
  // Create a group for the graph elements
  
  const container = svg.append("g");
  
  // Enable zooming and panning behavior
  const zoom = d3.zoom().on("zoom", (event) => {
    container.attr("transform", event.transform);
  });
  svg.call(zoom);
  

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
      .attr("r", 6)
      .style("cursor", "pointer")

      // Create the labels for all nodes
      const labels = svg
        .selectAll(".label")
        .data(data.nodes)
        .enter()
        .append("text")
        .attr("class", "label")
        .text((d) => d.id)
        .style("fill", "white")
        .style("visibility", "hidden");
      

    // Update the label text on mouseover
nodes.on("mouseover", function (event, d) {

  // Calculate the scaled coordinates relative to the current zoom level and the node's position
  const transform = d3.zoomTransform(svg.node());
  const scaledX = (d.x * transform.k) + transform.x;
  const scaledY = (d.y * transform.k) + transform.y;

  // Creates a new label
  const label = svg.append('text')
    .data([d])
    .attr('class', 'label')
    .html(
      (labelData) =>
        `<tspan>${labelData.id}</tspan><tspan x="0" dy="1.2em">Employees: ${labelData.amount_of_employees}</tspan><tspan x="0" dy="1.2em">Therapy Area: ${labelData.therapy_areas}</tspan><tspan x="0" dy="1.2em">Financing: ${labelData.financing}</tspan>`
    )
    .style("visibility", "visible")
    .style("fill", "white")
    .attr("x", scaledX)
    .attr("y", scaledY - 10); // Adjust the y position to position the label above the node

  label
    .selectAll("tspan")
    .attr("x", scaledX + 15)
    .attr("dy", "1.2em");
})
.on("mouseout", function (event, d) {
  svg.selectAll(".label").remove();

label.style("visibility", "hidden") // Hide label on mouseout

})

// Adds a smooth zoom function on click for the nodes
.on("click", function (event, d) {
  event.stopPropagation();
  const dx = d.x,
        dy = d.y,
        scale = 1.7; // affects the zoom level
  const translate = [svg.node().width.baseVal.value / 2 - scale * dx, svg.node().height.baseVal.value / 2 - scale * dy];

  svg.transition()
    .duration(3000) // Transition duration here, 3000 is 3 seconds
    .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
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

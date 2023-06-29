// Fetch the JSON data
fetch("../datasets/co_data.json")
  .then((res) => res.json())
  .then((data) => {
    const therapyAreas = [
      ...new Set(data.nodes.map((node) => node.therapy_areas)),
    ]

    const filterDropdown = d3.select("#filterDropdown")

    filterDropdown
      .selectAll("option")
      .data(therapyAreas)
      .enter()
      .append("option")
      .attr("value", (d) => d)
      .text((d) => d)

    filterDropdown.on("change", handleFilterSelection)

    function handleFilterSelection() {
      const selectedArea = this.value // Get the selected therapy area

      // Update the node sizes based on the filter selection
      nodes
        .attr("r", (d) => {
          if (selectedArea === "") {
            return 6 // Revert to the default node size when "All Therapy Areas" is selected
          } else {
            return d.therapy_areas.includes(selectedArea) ? 10 : 6
          }
        })
        .style("opacity", (d) =>
          selectedArea === "" || d.therapy_areas.includes(selectedArea)
            ? 1
            : 0.5
        )
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
            return d.amount_of_employees >= minEmployees ? 10 : 6
          }
        })
        .style("opacity", (d) =>
          minEmployees === 0 || d.amount_of_employees >= minEmployees ? 1 : 0.5
        )
    }

    // Create the SVG container
    const svg = d3.select("#graph")

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
    const links = svg
      .selectAll(".link")
      .data(data.links)
      .enter()
      .append("line")
      .attr("class", "link")
      .style("stroke", "rgba(255, 255, 255, 1)") // Set the color of the links

    // Create the nodes
    const nodes = svg
      .selectAll(".node")
      .data(data.nodes)
      .enter()
      .append("circle")
      .attr("class", "node")
      .attr("r", 6)

    // Add labels to the nodes
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
    // Update the label text on mouseover
    nodes
      .on("mouseover", function (event, d) {
        const node = d3.select(this)
        const label = labels.filter((labelData) => labelData.id === d.id)

        // node.attr("r", 12) // Increase node size on mouseover

        label
          .html(
            (labelData) =>
              `<tspan>${labelData.id}</tspan><tspan x="0" dy="1.2em">Employees: ${labelData.amount_of_employees}</tspan><tspan x="0" dy="1.2em">Therapy Area: ${labelData.therapy_areas}</tspan>`
          )
          .style("visibility", "visible")
          .attr("x", event.pageX)
          .attr("y", event.pageY - 10) // Adjust the y position to position the label above the cursor

        // Adjust the x and dy attributes of each tspan for proper alignment and line breaks
        label
          .selectAll("tspan")
          .attr("x", event.pageX + 15)
          .attr("dy", "1.2em")
      })

      .on("mouseout", function (event, d) {
        const node = d3.select(this)
        const label = labels.filter((labelData) => labelData.id === d.id)

        // node.attr("r", 6) // Revert node size on mouseout
        label.style("visibility", "hidden") // Hide label on mouseout
      })

    // Update the node and link positions on each tick of the simulation
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
// Fetch the JSON data
fetch("../datasets/co_data_test.json")
  .then((res) => res.json())
  .then((data) => {
    const therapyAreas = [
      ...new Set(data.nodes.map((node) => node.therapy_areas)),
    ]

    const type_of_company = [
      ...new Set(data.nodes.map((node) => node.type_of_company)),
    ]

    var regExp = /[a-zA-Z]/g
    // Create a list with all unique therapy areas
    let therapy_list = []
    for (let i = 0; i < therapyAreas.length; i++) {
      let current_words = therapyAreas[i]
        .split(" & ")
        .join(",")
        .split("N/A")
        .join(",")
        .split("/ ")
        .join(",")
        .split(",")
      for (let j = 0; j < current_words.length; j++) {
        current_words[j] = current_words[j].trim()
        if (current_words[j].includes("with")) {
          let index = current_words[j].indexOf("with")
          filtered_string = current_words[j].slice(0, index)
          current_words[j] = filtered_string
        }
        if (current_words[j].includes("(")) {
          let index = current_words[j].indexOf("(")
          filtered_string = current_words[j].slice(0, index)
          current_words[j] = filtered_string
        }
        if (
          !therapy_list.includes(current_words[j]) &&
          regExp.test(current_words[j])
        ) {
          therapy_list.push(current_words[j])
        }
      }
    }

    let type_list = []

    for (let i = 0; i < type_of_company.length; i++) {
      let current_words = type_of_company[i]
        .split(" & ")
        .join(",")
        .split("N/A")
        .join(",")
        .split("/ ")
        .join(",")
        .split(",")
      for (let j = 0; j < current_words.length; j++) {
        current_words[j] = current_words[j].trim()
        if (current_words[j].includes("with")) {
          let index = current_words[j].indexOf("with")
          filtered_string = current_words[j].slice(0, index)
          current_words[j] = filtered_string
        }
        if (current_words[j].includes("(")) {
          let index = current_words[j].indexOf("(")
          filtered_string = current_words[j].slice(0, index)
          current_words[j] = filtered_string
        }
        if (
          !type_list.includes(current_words[j]) // Regex tog bort drugs av någon anledning
        ) {
          type_list.push(current_words[j])
        }
      }
    }

    // Defines a function that is globally accessible for the label buttons
    window.handleButtonClick = function () {
      d3.select("svg").selectAll(".clickedLabelGroup").remove()
    }

    const filterDropdown = d3.select("#filterDropdown")
    const filterDropdownCompanyType = d3.select("#filterDropdownCompanyType")

    const privateCheckbox = d3.select("#privateCheckbox")
    const publicCheckbox = d3.select("#publicCheckbox")
    const employeeRange = document.getElementById("employeeRange")

    privateCheckbox.on("change", handleFilterSelection)
    publicCheckbox.on("change", handleFilterSelection)

    filterDropdown
      .selectAll("option")
      .data(therapy_list)
      .enter()
      .append("option")
      .attr("value", (d) => d)
      .text((d) => d)

    filterDropdownCompanyType
      .selectAll("option")
      .data(type_list)
      .enter()
      .append("option")
      .attr("value", (d) => d)
      .text((d) => d)

    // Initialize filterState
    let filterState = {
      therapyArea: "",
      type_of_company: "",
      financing: {
        private: false,
        listed: false,
      },
      minEmployees: 0,
    }

    // Function to apply filters
    function applyFilters() {
      // Use the filterState to filter nodes
      nodes
        .attr("r", (d) => {
          // If the node is one of the special nodes, we do not filter
          if (["GoCo", "BioVentureHub", "Astra"].includes(d.id)) {
            return d.size
          }
          // Adjust radius based on filters
          let radius = d.size
          if (
            filterState.therapyArea !== "" &&
            d.therapy_areas.includes(filterState.therapyArea)
          ) {
            radius *= 1.0
          }
          if (
            filterState.type_of_company !== "" &&
            d.type_of_company.includes(filterState.type_of_company)
          ) {
            radius *= 1.0
          }
          if (
            (!filterState.financing.private && !filterState.financing.public) ||
            (filterState.financing.private && d.financing === "Private") ||
            (filterState.financing.public && d.financing === "Listed")
          ) {
            radius *= 1.0
          }
          if (d.amount_of_employees >= filterState.minEmployees) {
            radius *= 1.0
          }
          return radius
        })
        .style("opacity", (d) => {
          // If the node is one of the special nodes, do not filter
          if (["GoCo", "BioVentureHub", "Astra"].includes(d.id)) {
            return 1
          }
          // Adjust opacity based on filters
          let opacity = 1
          if (
            filterState.therapyArea !== "" &&
            !d.therapy_areas.includes(filterState.therapyArea)
          ) {
            opacity = 0.2
          }
          if (
            filterState.type_of_company !== "" &&
            !d.type_of_company.includes(filterState.type_of_company)
          ) {
            opacity = 0.2
          }
          if (
            (filterState.financing.private || filterState.financing.public) &&
            !(filterState.financing.private && d.financing === "Private") &&
            !(filterState.financing.public && d.financing === "Listed")
          ) {
            opacity = 0.2
          }
          if (!(d.amount_of_employees >= filterState.minEmployees)) {
            opacity = 0.2
          }
          return opacity
        })
    }

    // Handle therapy area filter
    function handleFilterDropdown(chosen_filter) {
      filterState.therapyArea = this.value
      applyFilters()
    }

    // Handle therapy area filter
    function handleFilterDropdown_type(chosen_filter) {
      filterState.type_of_company = this.value
      applyFilters()
    }

    // Handle financing filter
    function handleFilterSelection() {
      filterState.financing.private = privateCheckbox.property("checked")
      filterState.financing.public = publicCheckbox.property("checked")
      applyFilters()

      privateCheckbox.on("change", function () {
        if (this.checked) {
          publicCheckbox.property("checked", false)
        }
        handleFilterSelection.call(this)
      })

      publicCheckbox.on("change", function () {
        if (this.checked) {
          privateCheckbox.property("checked", false)
        }
        handleFilterSelection.call(this)
      })
    }

    // Handle employee range filter
    function handleEmployeeRangeSelection() {
      filterState.minEmployees = Math.pow(2, employeeRange.value)
      // update displayed value
      d3.select("#employeeValue").text(filterState.minEmployees)
      applyFilters()
    }

    // Attach event handlers to filters
    filterDropdown.on("change", handleFilterDropdown)
    filterDropdownCompanyType.on("change", handleFilterDropdown_type)
    privateCheckbox.on("change", handleFilterSelection)
    publicCheckbox.on("change", handleFilterSelection)
    employeeRange.addEventListener("input", handleEmployeeRangeSelection)

    // Create a function that links two nodes
    const DEFAULT_DISTANCE = 90
    const connectNodes = (source, target, distance = DEFAULT_DISTANCE) => {
      data.links.push({
        source,
        target,
        distance,
      })
    }

    // Not used for now but adds a distance to any link in the json file.
    //   for (let i = 0; i < data.links.length; i++) {
    //     if (i % 2 == 0) {
    //       data.links[i].distance = DEFAULT_DISTANCE - 40
    //     }
    //     data.links[i].distance = DEFAULT_DISTANCE
    //   }

    // Connect all the nodes to their Ecosystem node
    for (let i = 0; i < data.nodes.length; i++) {
      if (i % 2 == 0) {
        connectNodes(
          data.nodes[i].id,
          data.nodes[i].ecosystem,
          DEFAULT_DISTANCE / 2
        )
      }
      connectNodes(data.nodes[i].id, data.nodes[i].ecosystem)
    }

    // Set size depending on type of node
    for (let i = 0; i < data.nodes.length; i++) {
      if (data.nodes[i].size_in_visualisation == "big") {
        data.nodes[i].size = 50
      } else {
        data.nodes[i].size = 12
      }
    }

    // Manually connect the big nodes
    connectNodes("GoCo", "BioVentureHub", 250)
    connectNodes("Astra", "BioVentureHub", 250)
    connectNodes("GoCo", "Astra", 250)
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
        d3
          .forceLink(data.links)
          .id((d) => d.id)
          .distance((link) => link.distance)
      )
      .force("charge", d3.forceManyBody().strength(-100))
      .force(
        "center",
        d3.forceCenter(
          svg.node().width.baseVal.value / 2,
          svg.node().height.baseVal.value / 2
        )
      )

    // In defs we're going to add the images in the nodes
    var defs = svg.append("defs")

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
      .style("fill", (d) => "url(#" + d.id + ")")
      .attr("class", "node")
      .style("cursor", "pointer")
      .attr("r", (node) => node.size)

    // Adding the images in the nodes
    defs
      .selectAll("company-pattern")
      .data(data.nodes)
      .enter()
      .append("pattern")
      .attr("class", "company-pattern")
      .append("pattern")
      .attr("id", (d) => d.id)
      .attr("height", "100%")
      .attr("width", "100%")
      .attr("patternContentUnits", "objectBoundingBox")
      .append("image")
      .attr("height", 1)
      .attr("width", 1)
      .attr("preserveAspectRatio", "none")
      .attr("xmlns:xlink", "https://www.w3.org/1999/xlink")
      .attr("xlink:href", (d) => d.image_path)

    // Create the labels for all nodes
    const labels = svg
      .selectAll(".label")
      .data(data.nodes)
      .enter()
      .append("text")
      .attr("class", "label")
      .text((d) => d.company_name)
      .style("fill", "white")
      .style("visibility", "hidden")

    // Shows labels on mouseover
    nodes.on("mouseover", function (event, d) {
      // Calculate the scaled coordinates relative to the current zoom level and the node's position
      const transform = d3.zoomTransform(svg.node())
      const scaledX = d.x * transform.k + transform.x
      const scaledY = d.y * transform.k + transform.y

      // Creates a new label
      const label = svg
        .append("text")
        .data([d])
        .attr("class", "label")
        .html(
          (labelData) =>
            `<tspan>${labelData.id}</tspan>` +
            (labelData.amount_of_employees
              ? `<tspan x="0" dy="1.2em">Employees: ${labelData.amount_of_employees}</tspan>`
              : "") +
            `<tspan x="0" dy="1.2em">Therapy Area: ${labelData.therapy_areas}</tspan>` +
            (labelData.financing
              ? `<tspan x="0" dy="1.2em">Financing: ${labelData.financing}</tspan>`
              : "")
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

        svg.selectAll(".clickedLabelGroup").remove()

        // Create a group to hold the foreignObject and label

        const labelGroup = svg
          .append("g")
          .attr("class", "labelGroup")
          .style("visibility", "hidden")

        // Append a foreignObject to the group
        const foreignObject = labelGroup
          .append("foreignObject")
          .attr("x", scaledX + 15) // adjust position
          .attr("y", scaledY - 50) // adjust position
          .attr("width", 300) // set width
          .attr("height", 400) // set height
          .html(
            `<div class="info-box info-box-hidden">
        ${d.company_logo ? `<img src="${d.company_logo}" />` : ""}
           <h4>${d.company_name}</h4>
           <p>${
             d.type_of_company ? `Type of company: ${d.type_of_company}` : ""
           }</p>
           <p>${d.therapy_areas ? `Therapy area: ${d.therapy_areas}` : ""}</p>
           <p>${d.ceo ? `CEO: ${d.ceo}` : ""}</p>
           ${
             d.company_website
               ? `<a href="${d.company_website}" target="_blank" class="websiteButton">Visit Website</a>`
               : ""
           }
           </div>`
          )

        // Creates an animation that loads in the info-box
        setTimeout(() => {
          document
            .querySelector(".info-box")
            .classList.remove("info-box-hidden")
        }, 10)

        labelGroup.style("visibility", "visible") // make the labelGroup visible
      })

      .on("mouseout", function (event, d) {
        svg.selectAll(".labelGroup").remove() // remove group on mouseout
      })

    // Not used right now but this adds a smooth zoom function on click for the nodes
    // .on("click", function (event, d) {
    //   event.stopPropagation()
    //   const dx = d.x,
    //     dy = d.y,
    //     scale = 1.7 // affects the zoom level
    //   const translate = [
    //     svg.node().width.baseVal.value / 2 - scale * dx,
    //     svg.node().height.baseVal.value / 2 - scale * dy,
    //   ]

    //   svg
    //     .transition()
    //     .duration(3000) // Transition duration here, 3000 is 3 seconds
    //     .call(
    //       zoom.transform,
    //       d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
    //     )
    // })

    // Shows labels on click
    nodes.on("click", function (event, d) {
      const transform = d3.zoomTransform(svg.node())
      const scaledX = d.x * transform.k + transform.x
      const scaledY = d.y * transform.k + transform.y

      // Removes any already existing labels
      svg.selectAll(".clickedLabelGroup").remove()

      // Create a new label group for the clicked node
      const clickedLabelGroup = svg
        .append("g")
        .attr("class", "clickedLabelGroup")

      // Append a foreignObject to the group
      const foreignObject = clickedLabelGroup
        .append("foreignObject")
        .attr("x", scaledX + 15) // adjust position
        .attr("y", scaledY - 50) // adjust position
        .attr("width", 300) // set width
        .attr("height", 400) // set height
        .html(
          `<div class="info-click-box info-click-box-hidden">
        ${d.company_logo ? `<img src="${d.company_logo}" />` : ""}
           <h4>${d.company_name}</h4>
           <p>${
             d.type_of_company ? `Type of company: ${d.type_of_company}` : ""
           }</p>
          <p>${d.therapy_areas ? `Therapy area: ${d.therapy_areas}` : ""}</p>
          <p>${d.ceo ? `CEO: ${d.ceo}` : ""}</p>
           <button class="clickedLabelGroupButton" onclick="handleButtonClick()"></button>${
             d.company_website
               ? `<a href="${d.company_website}" target="_blank" class="websiteButton">Visit Website</a>`
               : ""
           }
         </div>`
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

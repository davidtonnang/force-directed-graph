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

    const first_view = new Set([
      "BioVentureHub",
      "Astra",
      "GoCo",
      "BVH_USP",
      "BVH_Companies",
      "BVH_Alumni",
    ])

    for (let node of data.nodes) {
      node.isVisible =
        first_view.has(node.id) || node.ecosystem === "BioVentureHub"
    }

    // Function that looks for string in a word, and removes it and everything after if it finds it
    function remove_all_after(word, char) {
      if (word.includes(char)) {
        let index = word.indexOf(char)
        filtered_string = word.slice(0, index)
      } else {
        filtered_string = word
      }

      return filtered_string
    }

    // Create a list with all unique therapy areas
    function createList(input, separator) {
      let list = ["Title"]
      for (let i = 0; i < input.length; i++) {
        let current_words = input[i].split(separator)
        for (let j = 0; j < current_words.length; j++) {
          current_words[j] = current_words[j].trim()
          current_words[j] = remove_all_after(current_words[j], "with")
          current_words[j] = remove_all_after(current_words[j], "(")
          if (!list.includes(current_words[j]) && current_words[j].length > 0) {
            list.push(current_words[j])
          }
        }
      }
      return list
    }

    let therapy_list = createList(therapyAreas, ",")
    let type_list = createList(type_of_company, ",")

    // Defines a function that is globally accessible for the label buttons
    window.handleButtonClick = function () {
      d3.select("svg").selectAll(".clickedLabelGroup").remove()
    }

    const privateCheckbox = d3.select("#privateCheckbox")
    const publicCheckbox = d3.select("#publicCheckbox")
    const employeeRange = document.getElementById("employeeRange")

    const filterContainer = d3
      .select("#graph")
      .append("foreignObject")
      .attr("x", "22")
      .attr("y", "0")
      .attr("width", "100%")
      .attr("height", "100%")
      .append("xhtml:div")
      .attr("class", "filter-container").html(`
  <div>
  <select id="filterDropdownCompanyType">
    <option value="">Type of Company</option>
  </select>
</div>

<div>
  <select id="filterDropdown">
    <option value="">All Therapy Areas</option>
  </select>
</div>
  `)

    // Adds Therapy area to the filtering
    const therapyAreaSelect = d3.select("#filterDropdown")
    therapyAreaSelect
      .selectAll("option")
      .data(therapy_list)
      .enter()
      .append("option")
      .text((d) => d)
      .attr("value", (d) => d)

    // Adds the Company Type to the filtering

    const companyTypeSelect = d3.select("#filterDropdownCompanyType")
    companyTypeSelect
      .selectAll("option")
      .data(type_list)
      .enter()
      .append("option")
      .text((d) => d)
      .attr("value", (d) => d)

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
          if (["BioVentureHub"].includes(d.id)) {
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
          if (
            [
              "BioVentureHub",
              "BVH_Companies",
              "BVH_Alumni",
              "BVH_USP",
            ].includes(d.id)
          ) {
            return 1
          }
          if (["Astra", "GoCo"].includes(d.id)) {
            return 0.2 // Keeps opacity lower for astra and goco
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
    function handleFilterDropdown(event) {
      filterState.therapyArea = event.target.value
      applyFilters()
    }

    // Handle type of company filter
    function handleFilterDropdown_type(event) {
      filterState.type_of_company = event.target.value
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
    therapyAreaSelect.on("change", handleFilterDropdown)
    companyTypeSelect.on("change", handleFilterDropdown_type)
    privateCheckbox.on("change", handleFilterSelection)
    publicCheckbox.on("change", handleFilterSelection)
    employeeRange.addEventListener("input", handleEmployeeRangeSelection)

    // Create a function that links two nodes
    const DEFAULT_DISTANCE = 100
    const connectNodes = (source, target, distance = DEFAULT_DISTANCE) => {
      data.links.push({
        source,
        target,
        distance,
        isVisible: true,
      })
    }

    // Connect all the nodes to their Ecosystem node
    for (let i = 0; i < data.nodes.length; i++) {
      // Check if the ecosystem of the current node matches that of 'BVH_Companies'
      let bvhCompaniesNode = data.nodes.find(
        (node) => node.id === "BVH_Companies"
      )
      let bioVentureHubNode = data.nodes.find(
        (node) => node.id === "BioVentureHub"
      )
      let bvhAlumniNode = data.nodes.find((node) => node.id === "BVH_Alumni")

      if (["BVH_Alumni", "BVH_USP"].includes(data.nodes[i].id)) {
        // Connect BVH_Alumni and BVH_Usp to BioVentureHub
        connectNodes(data.nodes[i].id, bioVentureHubNode.id, 200)
      } else if (
        data.nodes[i].ecosystem === bvhCompaniesNode.ecosystem &&
        data.nodes[i].id != "BioVentureHub"
      ) {
        // For other nodes, connect them to BVH_Companies if they belong to the same ecosystem
        connectNodes(
          data.nodes[i].id,
          "BVH_Companies",
          i % 2 == 0 ? DEFAULT_DISTANCE / 1.5 : DEFAULT_DISTANCE
        )
      } else if (data.nodes[i].ecosystem.includes("Alumni")) {
        // For nodes with "Alumni" in their ecosystem, connect them to BVH_Alumni
        connectNodes(
          data.nodes[i].id,
          bvhAlumniNode.id, // Connect to BVH_Alumni
          i % 2 == 0 ? DEFAULT_DISTANCE / 1.5 : DEFAULT_DISTANCE
        )
      }
    }

    // Set size depending on type of node
    for (let i = 0; i < data.nodes.length; i++) {
      if (data.nodes[i].size_in_visualization == "big") {
        data.nodes[i].size = 50
      } else if (data.nodes[i].size_in_visualization == "BVH") {
        data.nodes[i].size = 35
      } else {
        data.nodes[i].size = 12
      }
    }

    // Manually connect the big nodes
    connectNodes("GoCo", "BioVentureHub", 200)
    connectNodes("Astra", "BioVentureHub", 200)
    connectNodes("GoCo", "Astra", 200)
    connectNodes("BioVentureHub", "BVH_Companies", 1000)
    // Create the SVG container
    const svg = d3.select("#graph")

    // Create a group for the graph elements

    const container = svg.append("g")

    // Enable zooming and panning behavior
    const zoom = d3.zoom().on("zoom", (event) => {
      container.attr("transform", event.transform)
    })
    svg.call(zoom)

    const bvhOffsetX = 100 // adjust this value to move BVH_Companies to the right
    const bioVentureHubOffsetX = 200 // adjust this value to move BioVentureHub to the right

    const bvhX = svg.node().width.baseVal.value / 2 + bvhOffsetX // X coordinate for BVH_Companies
    const bvhY = svg.node().height.baseVal.value / 2 // Y coordinate for BVH_Companies

    const bioVentureHubX =
      svg.node().width.baseVal.value / 2 + bioVentureHubOffsetX
    const bioVentureHubY = svg.node().height.baseVal.value / 2

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
      .force("charge", d3.forceManyBody().strength(-200))
      .force(
        "center",
        d3
          .forceCenter(
            svg.node().width.baseVal.value / 2,
            svg.node().height.baseVal.value / 2
          )
          .strength(0.0001)
      )
      .force(
        "circular",
        d3
          .forceRadial(
            (d) =>
              d.index % 2 == 0 ? DEFAULT_DISTANCE / 1.5 : DEFAULT_DISTANCE,
            bvhX,
            bvhY
          )
          .strength(function (d) {
            // gör varannan
            if (d.ecosystem == "BioVentureHub") return 1.5
            else return 0
          })
      )
      .force(
        "BVH_USP_forceY",
        d3
          .forceY()
          .strength((node) => (node.id === "BVH_USP" ? 0.5 : 0))
          .y(svg.node().height.baseVal.value / 4) // affects the y-position for the BVH_USP node
      )
      .force(
        "BVH_Alumni_forceY",
        d3
          .forceY()
          .strength((node) => (node.id === "BVH_Alumni" ? 0.5 : 0))
          .y((3 * svg.node().height.baseVal.value) / 4) // affects the y-position for the BVH_Alumni node
      )
      .force(
        "BVH_USP_forceX",
        d3
          .forceX()
          .strength((node) => (node.id === "BVH_USP" ? 0.5 : 0))
          .x((3.5 * svg.node().width.baseVal.value) / 7) // affects the x-position for the BVH_USP node
      )
      .force(
        "BVH_Alumni_forceX",
        d3
          .forceX()
          .strength((node) => (node.id === "BVH_Alumni" ? 0.5 : 0))
          .x((3.5 * svg.node().width.baseVal.value) / 7) // affects the x-position for the BVH_Alumni node
      )
      .force(
        "Astra_forceY",
        d3
          .forceY()
          .strength((node) => (node.id === "Astra" ? 0.5 : 0))
          .y(svg.node().height.baseVal.value / 4) // affects the y-position for the BVH_USP node
      )
      .force(
        "GoCo_forceY",
        d3
          .forceY()
          .strength((node) => (node.id === "GoCo" ? 0.5 : 0))
          .y((3 * svg.node().height.baseVal.value) / 4) // affects the y-position for the BVH_Alumni node
      )
      .force(
        "Astra_forceX",
        d3
          .forceX()
          .strength((node) => (node.id === "Astra" ? 0.5 : 0))
          .x((1 * svg.node().width.baseVal.value) / 7) // affects the x-position for the BVH_USP node
      )
      .force(
        "GoCo_forceX",
        d3
          .forceX()
          .strength((node) => (node.id === "GoCo" ? 0.5 : 0))
          .x((1 * svg.node().width.baseVal.value) / 7) // affects the x-position for the BVH_Alumni node
      )

    // In defs we're going to add the images in the nodes
    var defs = svg.append("defs")

    // Adjust x value accordingly to place it to the right
    const rightPanelContainer = d3
      .select("#graph")
      .append("foreignObject")
      .attr("x", "80%") // Position from the left
      .attr("y", "0") // Position from the top
      .attr("width", "20%") // Width of the rectangle
      .attr("height", "100%") // Full height of the rectangle

    // Append a div to the foreignObject
    const rightPanelDiv = rightPanelContainer
      .append("xhtml:div")
      .attr("id", "rightPanel") // give the div an id for easy selection
      .style("height", "100%")
      .style("width", "100%")
      .style("background", "white")

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
      .style("display", (d) => (d.isVisible ? "inline" : "none"))
      .style("opacity", function (node) {
        if (["Astra", "GoCo"].includes(node.id)) {
          return 0.2
        } else {
          return 1
        }
      }) // Sets opacity lower for astra and goco from start

    const links = container
      .selectAll(".link")
      .data(data.links)
      .enter()
      .append("line")
      //      .attr("class", "link")
      //      .style("stroke", "rgba (255,255,255,1")
      .style("display", (d) =>
        d.source.isVisible && d.target.isVisible ? "inline" : "none"
      )
      .attr("class", function (d) {
        if (
          d.source.size_in_visualization == "big" &&
          d.target.size_in_visualization == "BVH"
        ) {
          return "dashed"
        } else {
          return "solid"
        }
      })
      .lower()

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

    data.nodes[0].y = svg.node().height.baseVal.value / 2
    data.nodes[0].x = svg.node().width.baseVal.value / 2

    var bvh_x = data.nodes[0].x // Important that bvh is first in json
    var bvh_y = data.nodes[1].y // samma problem med bvhY

    for (let i = 0; i < data.nodes.length; i++) {
      if (
        data.nodes[i].y > bvh_y &&
        i % 2 == 1 &&
        Math.abs(data.nodes[i].y - bvh_y) > 30
      ) {
        data.nodes[i].label_adjustment = -300
      } else if (
        data.nodes[i].y > bvh_y &&
        (i % 2 == 0 || Math.abs(data.nodes[i].y - bvh_y) < 30)
      ) {
        data.nodes[i].label_adjustment = -200
      } else if (
        (data.nodes[i].y < bvh_y && i % 2 == 0) ||
        Math.abs(data.nodes[i].y - bvh_y) < 30
      ) {
        data.nodes[i].label_adjustment = -100
      } else {
        data.nodes[i].label_adjustment = 0
      }
      if (data.nodes[i].size_in_visualization == "big") {
        data.nodes[i].label_adjustment = 0
      }
    }

    nodes
      .on("mouseover", function (event, d) {
        const transform = d3.zoomTransform(svg.node())
        const scaledX = d.x * transform.k + transform.x
        const scaledY = d.y * transform.k + transform.y

        // Console logs the node's Y value
        for (let i = 0; i < data.nodes.length; i++) {
          console.log(data.nodes[i])
          console.log(data.nodes[i].y)
        }

        svg.selectAll(".clickedLabelGroup").remove()

        // Create a group to hold the foreignObject and label

        const labelGroup = svg
          .append("g")
          .attr("class", "labelGroup")
          .style("visibility", "hidden")

        // Append a foreignObject to the group
        const foreignObject = labelGroup
          .append("foreignObject")
          .attr("x", scaledX + 15) // adjust position  här
          .attr("y", scaledY + d.label_adjustment) // adjust position
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

    // Shows labels inside panel on click
    nodes.on("click", function (event, d) {
      if (d.size_in_visualization === "medium") {
        // Clear the existing content of rightPanelDiv
        d3.select("#rightPanel").html("")

        // Append new content to the right panel div
        d3.select("#rightPanel")
          .append("img") // Add this line
          .attr("src", d.company_logo) // And this line
          .attr("alt", `${d.company_name} logo`) // And this line
          .attr("width", "200") // And this line, adjust the width as necessary
          .attr("class", "company_logo_panel")

        d3.select("#rightPanel").append("h4").text(`Company: ${d.company_name}`)

        // Create the paragraph
        const p = d3.select("#rightPanel").append("p")

        // Append the non-clickable part of the text
        p.append("span")
          .text(`Type of Company: `)
          .attr("class", "type_of_company_panel_header")

        // Split the type_of_company string into an array
        const typesOfCompany = d.type_of_company.split(", ")

        // For each type of company, append a clickable span
        typesOfCompany.forEach((type, index) => {
          if (index !== 0) {
            // If it's not the first type, prepend a comma and a space
            p.append("span").text(", ")
          }

          p.append("span")
            .attr("class", "type_of_company_panel_text")
            .style("cursor", "pointer") // Make the text look clickable
            .style("text-decoration", "none") // Remove the underline
            .text(type)
            .on("click", function () {
              // Add the click event
              // Set the filterState to the clicked type_of_company
              filterState.type_of_company = type

              // Call the applyFilters function
              applyFilters()

              // Reset the dropdown to match the selected type of company
              companyTypeSelect.property("value", type)
            })
        })

        d3.select("#rightPanel")
          .append("p")
          .text(`Therapy area: ${d.therapy_areas}`)
          .attr("class", "therapy_area_panel")

        d3.select("#rightPanel")
          .append("p")
          .text(`CEO: ${d.ceo}`)
          .attr("class", "ceo_panel")

        d3.select("#rightPanel")
          .append("p")
          .attr("class", "mission_statement_header")
          .text(`Mission Statement:`)

        d3.select("#rightPanel")
          .append("p")
          .attr("class", "mission_statement_text")
          .text(`${d.mission_statement}`)

        if (d.company_website) {
          d3.select("#rightPanel")
            .append("a")
            .attr("href", d.company_website)
            .attr("target", "_blank")
            .attr("class", "websiteButton")
            .text("Visit Website")
        }
      } else {
        // Fetch BVH_USP and BVH_Alumni nodes
        const bvhUspNode = data.nodes.find((node) => node.id === "BVH_USP")
        const bvhAlumniNode = data.nodes.find(
          (node) => node.id === "BVH_Alumni"
        )
        const companiesNode = data.nodes.find(
          (node) => node.id === "Antaros_Medical"
        )
        const alumniCompNode = data.nodes.find(
          (node) => node.id === "alumni_company_one"
        )
        if (
          d.id === "BioVentureHub" ||
          d.id === "BVH_Companies" ||
          d.id === "BVH_Alumni" ||
          d.id === "USP"
        ) {
          if (d.id === "BioVentureHub") {
            if (bvhCompaniesNode.isVisible && companiesNode.isVisible) {
              toggle_ecosystem("BioVentureHub")
            }
            if (bvhAlumniNode.isVisible && alumniCompNode.isVisible) {
              toggle_ecosystem("Alumni")
            }
            bvhCompaniesNode.isVisible = !bvhCompaniesNode.isVisible
            bvhUspNode.isVisible = !bvhUspNode.isVisible
            bvhAlumniNode.isVisible = !bvhAlumniNode.isVisible
          }

          if (d.id === "BVH_Companies") {
            toggle_ecosystem("BioVentureHub")
          }

          if (d.id === "BVH_Alumni") {
            toggle_ecosystem("Alumni")
          }
          // update node display
          nodes.style("display", (d) =>
            SPECIAL_IDS.includes(d.id) || d.isVisible ? "inline" : "none"
          )

          // update link display
          links.style("display", (d) => updateLinkVisibility_2(d))
        }
      }
    })

    const SPECIAL_IDS = ["BioVentureHub", "GoCo", "Astra"]

    function updateLinkVisibility_2(d) {
      if (d.source.isVisible && d.target.isVisible) return "inline"
      else return "none"
    }

    function toggle_ecosystem(ecoSys, bvh = false) {
      for (let i = 0; i < data.nodes.length; i++) {
        if (
          data.nodes[i].ecosystem == ecoSys &&
          data.nodes[i].size_in_visualization == "medium"
        ) {
          // Toggle node visibility
          data.nodes[i].isVisible = !data.nodes[i].isVisible

          // Update visibility for links connected to this node
          data.links.forEach((link) => {
            if (
              link.source.id === data.nodes[i].id ||
              link.target.id === data.nodes[i].id
            ) {
              link.isVisible = data.nodes[i].isVisible
            }
          })

          // Select the node that is being toggled and apply the transition
          d3.select("#graph")
            .selectAll(".node")
            .filter((node) => node.id === data.nodes[i].id)
            .style("opacity", 0)
            .transition()
            .duration(2000)
            .style("opacity", data.nodes[i].isVisible ? 1 : 0)

          // Select the links that are being toggled and apply the transition
          d3.select("#graph")
            .selectAll(".link")
            .filter(
              (link) =>
                link.source.id === data.nodes[i].id ||
                link.target.id === data.nodes[i].id
            )
            .style("opacity", 0)
            .transition()
            .duration(2000)
            .style("opacity", data.links[i].isVisible ? 1 : 0)
        }
      }
    }

    // This block will always show the link between BVH Companies and BioVentureHub if BVH Companies node is visible
    // nodes.on("click", function (event, d) {
    //   console.log("hello")
    //   // Fetch BVH_USP and BVH_Alumni nodes
    //   const bvhUspNode = data.nodes.find((node) => node.id === "BVH_USP")
    //   const bvhAlumniNode = data.nodes.find((node) => node.id === "BVH_Alumni")
    //   const companiesNode = data.nodes.find(
    //     (node) => node.id === "Antaros_Medical"
    //   )
    //   const alumniCompNode = data.nodes.find(
    //     (node) => node.id === "alumni_company_one"
    //   )
    //   if (
    //     d.id === "BioVentureHub" ||
    //     d.id === "BVH_Companies" ||
    //     d.id === "BVH_Alumni" ||
    //     d.id === "USP"
    //   ) {
    //     if (d.id === "BioVentureHub") {
    //       if (bvhCompaniesNode.isVisible && companiesNode.isVisible) {
    //         toggle_ecosystem("BioVentureHub")
    //       }
    //       if (bvhAlumniNode.isVisible && alumniCompNode.isVisible) {
    //         toggle_ecosystem("Alumni")
    //       }
    //       bvhCompaniesNode.isVisible = !bvhCompaniesNode.isVisible
    //       bvhUspNode.isVisible = !bvhUspNode.isVisible
    //       bvhAlumniNode.isVisible = !bvhAlumniNode.isVisible
    //     }

    //     if (d.id === "BVH_Companies") {
    //       toggle_ecosystem("BioVentureHub")
    //     }

    //     if (d.id === "BVH_Alumni") {
    //       toggle_ecosystem("Alumni")
    //     }
    //     // update node display
    //     nodes.style("display", (d) =>
    //       SPECIAL_IDS.includes(d.id) || d.isVisible ? "inline" : "none"
    //     )

    //     // update link display
    //     links.style("display", (d) => updateLinkVisibility_2(d))
    //   }
    // })

    const bvhCompaniesNode = data.nodes.find(
      (node) => node.id === "BVH_Companies"
    )

    // Updates the node and link positions on each tick of the simulation
    simulation.on("tick", () => {
      links
        .attr("x1", (d) => d.source.x)
        .attr("y1", (d) => d.source.y)
        .attr("x2", (d) => d.target.x)
        .attr("y2", (d) => d.target.y)

      links.style("display", (d) => updateLinkVisibility_2(d))

      nodes.attr("cx", (d) => d.x).attr("cy", (d) => d.y)

      labels.attr("x", (d) => d.x + 10).attr("y", (d) => d.y - 10)
      //data.nodes[0].y = svg.node().height.baseVal.value / 2
      //data.nodes[0].x = svg.node().width.baseVal.value / 2
      data.nodes[1].y = bvhY
      data.nodes[1].x = bvhX
    })

    function ticked() {
      var alpha = this.alpha()
      var chargeStrength

      if (alpha > 0.2) {
        chargeStrength = alpha - 0.2 / 0.8
      } else {
        chargeStrength = 0
      }

      this.force("charge", d3.forceManyBody().strength(-30 * chargeStrength))
    }
    // simulation.on("tick", ticked)
  })

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

    data.nodes.forEach((node) => {
      node.isVisible = ["BioVentureHub", "Astra", "GoCo"].includes(node.id)
    })

    //var regExp = /[a-zA-Z]/g

    // Attempt to make function that removes characters and splits a long string to a list
    //function remove_characters(words, character_list) {
    //  for (let i = 0; character_list.length; i++) {
    //    words.split(character_list[i])
    //    words.join(",")
    //  }
    //  words.split(",")
    //  return words
    //}

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
          if (["BioVentureHub"].includes(d.id)) {
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
      }
    }

    // Not used for now but adds a distance to any link in the json file.
    //   for (let i = 0; i < data.links.length; i++) {
    //     if (i % 2 == 0) {
    //       data.links[i].distance = DEFAULT_DISTANCE - 40
    //     }
    //     data.links[i].distance = DEFAULT_DISTANCE
    //   }

    // Set size depending on type of node
    for (let i = 0; i < data.nodes.length; i++) {
      if (data.nodes[i].size_in_visualisation == "big") {
        data.nodes[i].size = 50
      } else if (data.nodes[i].size_in_visualisation == "BVH") {
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
          .strength(0.001)
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

    console.log(data.nodes[0])

    // In defs we're going to add the images in the nodes
    var defs = svg.append("defs")

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
          d.source.size_in_visualisation == "big" &&
          d.target.size_in_visualisation == "BVH"
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
      if (data.nodes[i].size_in_visualisation == "big") {
        data.nodes[i].label_adjustment = 0
      }
    }

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
        .attr("y", scaledY + d.label_adjustment) // adjust position  här!
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

    const SPECIAL_IDS = ["BioVentureHub", "GoCo", "Astra"]

    function updateLinkVisibility(d, bvhCompaniesNode) {
      if (
        (d.source.id === "BioVentureHub" &&
          d.target.id === "BVH_Companies" &&
          bvhCompaniesNode.isVisible) ||
        (d.target.id === "BioVentureHub" &&
          d.source.id === "BVH_Companies" &&
          bvhCompaniesNode.isVisible) ||
        (SPECIAL_IDS.includes(d.source.id) && SPECIAL_IDS.includes(d.target.id))
      ) {
        return "inline"
      }

      if (
        ((d.source.id === "BVH_Alumni" || d.source.id === "BVH_USP") &&
          d.source.isVisible) ||
        ((d.target.id === "BVH_Alumni" || d.target.id === "BVH_USP") &&
          d.target.isVisible)
      ) {
        return "inline"
      }

      return d.isVisible && d.source.isVisible && d.target.isVisible
        ? "inline"
        : "none"
    }

    // This block will always show the link between BVH Companies and BioVentureHub if BVH Companies node is visible

    nodes.on("click", function (event, d) {
      // Fetch BVH_USP and BVH_Alumni nodes
      const bvhUspNode = data.nodes.find((node) => node.id === "BVH_USP")
      const bvhAlumniNode = data.nodes.find((node) => node.id === "BVH_Alumni")
      if (d.id === "BioVentureHub" || d.id === "BVH_Companies") {
        // This block will always show the link between BVH Companies and BioVentureHub if BVH Companies node is visible
        const linkBetweenBHAndBVC = data.links.find(
          (link) =>
            ["BioVentureHub", "BVH_Companies"].includes(link.source.id) &&
            ["BioVentureHub", "BVH_Companies"].includes(link.target.id)
        )
        if (linkBetweenBHAndBVC) {
          linkBetweenBHAndBVC.isVisible = bvhCompaniesNode.isVisible
        }

        if (bvhCompaniesNode.isVisible && d.id === "BioVentureHub") {
          bvhCompaniesNode.isVisible = false
          if (bvhUspNode) {
            bvhUspNode.isVisible = !bvhUspNode.isVisible
          }
          if (bvhAlumniNode) {
            bvhAlumniNode.isVisible = !bvhAlumniNode.isVisible
          }
          data.links.forEach((link) => {
            if (
              link.source.id === "BVH_Alumni" &&
              link.target.id !== "BioVentureHub"
            ) {
              link.isVisible = bvhAlumniNode.isVisible
            } else if (
              link.target.id === "BVH_Alumni" &&
              link.source.id !== "BioVentureHub"
            ) {
              link.isVisible = bvhAlumniNode.isVisible
            }
            if (
              link.source.id === "BVH_USP" &&
              link.target.id !== "BioVentureHub"
            ) {
              link.isVisible = bvhUspNode.isVisible
            } else if (
              link.target.id === "BVH_USP" &&
              link.source.id !== "BioVentureHub"
            ) {
              link.isVisible = bvhUspNode.isVisible
            }
            if (link.source.id === "BVH_Companies") {
              link.target.isVisible = false
              link.isVisible = false
            } else if (link.target.id === "BVH_Companies") {
              link.source.isVisible = false
              link.isVisible = false
            }
          })
        } else {
          data.links.forEach((link) => {
            if (
              link.source.id === "BioVentureHub" &&
              ["GoCo", "Astra"].includes(link.target.id)
            ) {
              link.target.isVisible = true
            } else if (
              link.target.id === "BioVentureHub" &&
              ["GoCo", "Astra"].includes(link.source.id)
            ) {
              link.source.isVisible = true
            } else if (
              link.source.id === d.id &&
              link.target.id !== d.id &&
              link.target.id !== "BioVentureHub"
            ) {
              link.target.isVisible = !link.target.isVisible
              if (d.id === "BVH_Companies") {
                link.isVisible = link.target.isVisible
              }
            } else if (
              link.target.id === d.id &&
              link.source.id !== d.id &&
              link.source.id !== "BioVentureHub"
            ) {
              link.source.isVisible = !link.source.isVisible
              if (d.id === "BVH_Companies") {
                link.isVisible = link.source.isVisible
              }
            }
          })
        }

        // update node display
        nodes.style("display", (d) =>
          SPECIAL_IDS.includes(d.id) || d.isVisible ? "inline" : "none"
        )

        // update link display
        links.style("display", (d) => updateLinkVisibility(d, bvhCompaniesNode))
      }
    })

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

      links.style("display", (d) => updateLinkVisibility(d, bvhCompaniesNode))

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

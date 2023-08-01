// Fetch the JSON data

fetch("../datasets/co_data_test.json")
  .then((res) => res.json())

  // Creates unique values into a different Set array from our data.nodes to elimante duplicates for our filters
  .then((data) => {
    const therapyAreas = [
      ...new Set(data.nodes.map((node) => node.therapy_areas)),
    ]

    const type_of_company = [
      ...new Set(data.nodes.map((node) => node.type_of_company)),
    ]

    // Here we keep all constant values
    const DEFAULT_DISTANCE = 120 // Old value was = 100
    const BIG_NODE_DISTANCE = 200
    const SIZE_BIGGEST_NODES = 50
    const SIZE_BVH_NODES = 35
    const SIZE_COMPANY_NODES = 15 // Old value was = 12
    const bvhOffsetX = 100 // adjust this value to move BVH_Companies
    const bioVentureHubOffsetX = 200 // adjust this value to move BioVentureHub

    const first_view = new Set([
      "BioVentureHub",

      "Astra",

      "GoCo",

      "BVH_USP",

      "BVH_Companies",

      "BVH_Alumni",
    ])

    // Makes all the nodes connected to BioVentureHub ecosystem visible at start
    for (let node of data.nodes) {
      node.isVisible =
        first_view.has(node.id) || node.ecosystem === "BioVentureHub" // Includes companies connected to GoCo visible at start to show how easy it is to add a new node in the JSON  ||
      // node.ecosystem === "GoCo"
    }

    // Function that looks for string in a word, and removes it and everything after if it finds it. Is used in the filter dropdown to shorten some of the unnecessary long names for therapy areas

    function remove_all_after(word, char) {
      if (word.includes(char)) {
        let index = word.indexOf(char)

        filtered_string = word.slice(0, index)
      } else {
        filtered_string = word
      }

      return filtered_string
    }

    // Create a list with all unique therapy areas, removes the part of the strings for therapy areas that have "with" and "(" together with everything after. Example: CVRM with focus on NASH -> CVRM.

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

    // Use the createList function to make the list of therapy areas and company types and makes it prettier. These will be used in the filter dropdown
    let therapy_list = createList(therapyAreas, ",")

    let type_list = createList(type_of_company, ",")

    // Values for use in functions that select said elements from the index.html which are used in the handleFilterSelection as to know what to target.
    const privateCheckbox = d3.select("#privateCheckbox")

    const publicCheckbox = d3.select("#publicCheckbox")

    const employeeRange = document.getElementById("employeeRange")

    // Creates the filterContainer element that contain the dropdown menu for type of company and therapy area filters.
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

    // Adds the Therapy area list to the filtering options in the dropdown menu

    const therapyAreaSelect = d3.select("#filterDropdown")

    therapyAreaSelect

      .selectAll("option")

      .data(therapy_list)

      .enter()

      .append("option")

      .text((d) => d)

      .attr("value", (d) => d)

    // Adds the company type list to the filtering options in the second dropdown menu

    const companyTypeSelect = d3.select("#filterDropdownCompanyType")

    companyTypeSelect

      .selectAll("option")

      .data(type_list)

      .enter()

      .append("option")

      .text((d) => d)

      .attr("value", (d) => d)

    // Initialize filterState and state the data types. String for therapy area and company type. Boolean for financing and integer for employees. All of the filtering that is being done, gets stored into filterState and is used in applyFilters.

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
      //
      // Use the filterState to filter nodes by lowering the opacity for the nodes that don't match the users filter options

      nodes.style("opacity", (d) => {
        // If the node is one of the special nodes, they do not get their opacity affected no matter what filter options the user chooses

        if (
          ["BioVentureHub", "BVH_Companies", "BVH_Alumni", "BVH_USP"].includes(
            d.id
          )
        ) {
          return 1
        }

        if (["Astra", "GoCo"].includes(d.id)) {
          return 0.2 // Keeps opacity lower for Astra and GoCo as they are meant to be in background
        }

        // Adjust the node style opacity value into the filterState based on filters

        let opacity = 1

        // If the chosen therapy area from the dropdown does not match, get 0.2 opacity. The nodes that do match, keep their 1 opacity.
        if (!d.therapy_areas.includes(filterState.therapyArea)) {
          opacity = 0.2
        }

        // If the chosen company type from the dropdown does not match, get 0.2 opacity. The nodes that do match, keep their 1 opacity.
        if (!d.type_of_company.includes(filterState.type_of_company)) {
          opacity = 0.2
        }

        // Changes opacity of the nodes that does not match the box you clicked. If the user clicks on Private, every node that is not private will have lower opacity and vice versa.
        if (
          (filterState.financing.private || filterState.financing.public) &&
          !(filterState.financing.private && d.financing === "Private") &&
          !(filterState.financing.public && d.financing === "Listed")
        ) {
          opacity = 0.2
        }

        // If the node has less than the user's choosen employee value from the slider, they get lowered opacity. A value of 256 will affect the nodes with less than 256 employees to have 0.2 opacity.
        if (!(d.amount_of_employees >= filterState.minEmployees)) {
          opacity = 0.2
        }

        return opacity
      })
    }

    // The following functions updates the filterState based on the users input. They also run the applyFilters function to make the changes occur

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

    // Handle employee range filter. Note: Math.pow 2 makes the slidebar increase exponentially. This gives the slider a smoother feeling to it.

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

    // Create a function that links two nodes together. This is used to create all of the links.

    const connectNodes = (source, target, distance = DEFAULT_DISTANCE) => {
      data.links.push({
        source,

        target,

        distance,

        isVisible: true,
      })
    }

    // Connect all the nodes to their Ecosystem node

    let bvhCompaniesNode = data.nodes.find(
      (node) => node.id === "BVH_Companies"
    )

    let bioVentureHubNode = data.nodes.find(
      (node) => node.id === "BioVentureHub"
    )

    let bvhAlumniNode = data.nodes.find((node) => node.id === "BVH_Alumni")

    let gocoNode = data.nodes.find((node) => node.id === "GoCo")

    for (let i = 0; i < data.nodes.length; i++) {
      // If a node has the same ecosystem as "BVH_Companies", connect it to "BVH_Companies"
      if (
        data.nodes[i].ecosystem === bvhCompaniesNode.ecosystem &&
        data.nodes[i].id !== "BioVentureHub"
      ) {
        // Every other node gets a shorter distance as to create two different circles around the source node. (BVH_Companies)

        connectNodes(
          data.nodes[i].id,
          "BVH_Companies",
          i % 2 == 0 ? DEFAULT_DISTANCE / 1.5 : DEFAULT_DISTANCE
        )
      }
      // For nodes with "Alumni" in their ecosystem, connect them to BVH_Alumni
      else if (data.nodes[i].ecosystem.includes("Alumni")) {
        connectNodes(
          data.nodes[i].id,
          bvhAlumniNode.id,
          i % 2 == 0 ? DEFAULT_DISTANCE / 1.5 : DEFAULT_DISTANCE
        )
      }
      // For nodes with "GoCo" in their ecosystem, connect them to GoCo
      else if (data.nodes[i].ecosystem.includes("GoCo")) {
        connectNodes(
          data.nodes[i].id,
          gocoNode.id, // Connect to GoCo
          i % 2 == 0 ? DEFAULT_DISTANCE / 1.5 : DEFAULT_DISTANCE
        )
      }
    }

    // Set size depending on type of node.

    for (let i = 0; i < data.nodes.length; i++) {
      if (data.nodes[i].size_in_visualization == "big") {
        data.nodes[i].size = SIZE_BIGGEST_NODES
      } else if (data.nodes[i].size_in_visualization == "BVH") {
        data.nodes[i].size = SIZE_BVH_NODES
      } else {
        data.nodes[i].size = SIZE_COMPANY_NODES
      }
    }

    // Manually connect the big nodes

    connectNodes("GoCo", "BioVentureHub", BIG_NODE_DISTANCE)
    connectNodes("Astra", "BioVentureHub", BIG_NODE_DISTANCE)
    connectNodes("GoCo", "Astra", BIG_NODE_DISTANCE)
    connectNodes("BVH_Alumni", "BioVentureHub", BIG_NODE_DISTANCE)
    connectNodes("BVH_USP", "BioVentureHub", BIG_NODE_DISTANCE)
    connectNodes("BioVentureHub", "BVH_Companies", BIG_NODE_DISTANCE)

    // Creates the SVG container

    const svg = d3.select("#graph")

    // Create a group for the graph elements

    const container = svg.append("g")

    // Enable zooming and panning behavior

    const zoom = d3.zoom().on("zoom", (event) => {
      container.attr("transform", event.transform)
    })

    svg.call(zoom)

    // X coordinate for BVH_Companies
    const bvhX = svg.node().width.baseVal.value / 2 + bvhOffsetX

    // Y coordinate for BVH_Companies
    const bvhY = svg.node().height.baseVal.value / 2

    // Create the force simulation. Within the simulation, several forces are being applied.

    const simulation = d3

      .forceSimulation(data.nodes)

      // All the forces that are connected to the links are applied here.
      .force(
        "link",

        d3

          .forceLink(data.links)

          .id((d) => d.id)

          .distance((link) => link.distance)
      )

      // This force works as gravitation -200 means a repelling force, creating the spread and distance for the BVH_Company nodes. The gravitational force affects mostly the Company nodes as the other nodes have fixed positions.
      .force("charge", d3.forceManyBody().strength(-200))

      // Force that pulls the nodes to the center of the svg
      .force(
        "center",

        d3

          .forceCenter(
            svg.node().width.baseVal.value / 2,

            svg.node().height.baseVal.value / 2
          )

          .strength(0.0001)
      )

      // All the following forces affects individual nodes as to push them into their desired position
      .force(
        "BVH_USP_forceY",

        d3

          .forceY()

          .strength((node) => (node.id === "BVH_USP" ? 0.5 : 0))

          .y(svg.node().height.baseVal.value / 4)
      )

      .force(
        "BVH_Alumni_forceY",

        d3

          .forceY()

          .strength((node) => (node.id === "BVH_Alumni" ? 0.5 : 0))

          .y((3 * svg.node().height.baseVal.value) / 4)
      )

      .force(
        "BVH_USP_forceX",

        d3

          .forceX()

          .strength((node) => (node.id === "BVH_USP" ? 0.5 : 0))

          .x((3.5 * svg.node().width.baseVal.value) / 7)
      )

      .force(
        "BVH_Alumni_forceX",

        d3

          .forceX()

          .strength((node) => (node.id === "BVH_Alumni" ? 0.5 : 0))

          .x((3.5 * svg.node().width.baseVal.value) / 7)
      )

      .force(
        "Astra_forceY",

        d3

          .forceY()

          .strength((node) => (node.id === "Astra" ? 0.5 : 0))

          .y(svg.node().height.baseVal.value / 4)
      )

      .force(
        "GoCo_forceY",

        d3

          .forceY()

          .strength((node) => (node.id === "GoCo" ? 0.5 : 0))

          .y((3 * svg.node().height.baseVal.value) / 4)
      )

      .force(
        "Astra_forceX",

        d3

          .forceX()

          .strength((node) => (node.id === "Astra" ? 0.5 : 0))

          .x((1 * svg.node().width.baseVal.value) / 7)
      )

      .force(
        "GoCo_forceX",

        d3

          .forceX()

          .strength((node) => (node.id === "GoCo" ? 0.5 : 0))

          .x((1 * svg.node().width.baseVal.value) / 7)
      )

    // Creates the right panel to the side that greets the viewer
    const rightPanelContainer = d3

      .select("#graph")

      .append("foreignObject")

      .attr("x", "69.5%") // Position from the left

      .attr("y", "0") // Position from the top

      .attr("width", "30%") // Width of the rectangle

      .attr("height", "100%") // Full height of the rectangle

    // Append a div to the right panel and inserts a h2 and p tag that includes general start information regarding the visualiation and BioVentureHub as a company. Makes use of the rightPanel id in our CSS for styling the content

    const rightPanelDiv = rightPanelContainer

      .append("xhtml:div")

      .attr("id", "rightPanel")

      .style("height", "100%")

      .style("width", "100%").html(`
      <h2>Discover Our Ecosystem</h2>
      <p class="rightPanelEcosystemText">BioVentureHub is at the heart of Life Science in Gothenburg & Mölndal.</p>
      <p class="rightPanelEcosystemText">Daring to share, we're fostering a dynamic life science environment where scientific curiosity and collaborative efforts prevail over rigid business models, inspiring innovation and growth.</p>
      <p class="rightPanelEcosystemText">Dive into our ecosystem and see how we are shaping the future. Each of our company tells a unique story of innovation and growth. Start exploring freely or use the filter to find precisely what you wish to find.</p>
    `)

    // Creates the nodes

    const nodes = container

      .selectAll(".node")

      .data(data.nodes)

      .enter()

      .append("circle")

      .style("fill", (d) => "url(#" + d.id + ")")

      .attr("class", "node")

      .style("cursor", "pointer")

      .attr("r", (node) => node.size)

      // This method hides nodes based upon if the isVisible attribute is true or false. This is to not display all nodes from start and decide what start view we want to have
      .style("display", (d) => (d.isVisible ? "inline" : "none"))

      // Sets the opacity lower for Astra and GoCo from start as to make them appear in the background
      .style("opacity", function (node) {
        if (["Astra", "GoCo"].includes(node.id)) {
          return 0.2
        } else {
          return 1
        }
      })

    // Creates the links
    const links = container
      .selectAll(".link")
      .data(data.links)
      .enter()
      .append("line")
      // Runs updateLinkVisibility function once to make sure the links have correct isVisible value and then shows the links we want to show in the start view
      .style("display", (d) => {
        updateLinkVisibility(d)
        if (d.isVisible) return "inline"
        else return "none"
      })
      // Gives a dotted line to the Astra and GoCo nodes
      .attr("class", function (d) {
        if (d.source.size_in_visualization == "big") {
          return "dashed"
        } else {
          return "solid"
        }
      })
      .lower()

    // Adds the images into the nodes and styles them to fit

    var defs = svg.append("defs")

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

      .attr("xlink:href", (d) => d.image_path)

    // Create the labels for all nodes

    const labels = svg.enter()

    // Adjust position of info-box that displays on mouse over nodes.
    function setLabelAdjustment(bvh_y, node_y, node_x, size) {
      var label_adjustment_y = 0 // Top nodes (node_y + 80) < bvh_y

      var label_adjustment_x = 15

      if (node_y > bvh_y + 150) {
        label_adjustment_y = -230
      } else if (node_y > bvh_y + 15) {
        label_adjustment_y = -150
      } else if (Math.abs(node_y - bvh_y) < 15) {
        label_adjustment_y = -150
      } else if (node_y > bvh_y - 150) {
        label_adjustment_y = -100
      }

      if (size != "medium") {
        label_adjustment_y = 0
      }

      // svg.node is the entire width of the svg. 0.49 is 49% of the view

      // if the node is more than 49% of the screen to the right, meaning at the right side of the screen, the x value is pushed to the left. To ensure the label does not interfere with the right panel
      if (node_x > svg.node().width.baseVal.value * 0.49) {
        label_adjustment_x = -270
      }

      return [label_adjustment_y, label_adjustment_x]
    }

    // Mouse over function that creates the info-box when the user hovers their mouse over a node
    nodes

      .on("mouseover", function (event, d) {
        const transform = d3.zoomTransform(svg.node())
        // scaledX and scaledY are the X and Y positions considering the current zoom of the svg
        const scaledX = d.x * transform.k + transform.x

        const scaledY = d.y * transform.k + transform.y

        var bvh_y = data.nodes[1].y
        // Here we used the setLabelAdjustment function to get adjustments of the position of the info-box
        var adjustments = setLabelAdjustment(
          bvh_y,

          scaledY,

          scaledX,

          d.size_in_visualization
        )

        label_adjustment_y = adjustments[0]

        label_adjustment_x = adjustments[1]

        // Creates labelGroup

        const labelGroup = svg

          .append("g")

          .attr("class", "labelGroup")

          .style("visibility", "hidden")

        // Append a foreignObject to the labelGroup to create an info-box div on mouse over

        const foreignObject = labelGroup

          .append("foreignObject")

          .attr("x", scaledX + label_adjustment_x)

          .attr("y", scaledY + label_adjustment_y)

          .attr("width", 250)
          .attr("height", 400)

          .html(
            `<div class="info-box info-box-hidden">

        ${d.company_logo ? `<img src="${d.company_logo}" />` : ""}

           <h4>${d.company_name}</h4>

           <p>${
             d.type_of_company ? `Type of company: ${d.type_of_company}` : ""
           }</p>

           <p>${d.therapy_areas ? `Therapy area: ${d.therapy_areas}` : ""}</p>

           <p>${d.ceo ? `CEO: ${d.ceo}` : ""}</p>

           </div>`
          )

        // Creates an animation for the info-box on mouse over.

        setTimeout(() => {
          document

            .querySelector(".info-box")
            .classList.remove("info-box-hidden")
        }, 10)

        labelGroup.style("visibility", "visible")
      })

      // Removes the info-box on mouseout
      .on("mouseout", function (event, d) {
        svg.selectAll(".labelGroup").remove()
      })

    // Shows labels inside Rightpanel on node click

    nodes.on("click", function (event, d) {
      if (d.size_in_visualization === "medium") {
        // Clears the existing content of rightPanelDiv

        d3.select("#rightPanel").html("")

        // Append new content to the right panel div

        d3.select("#rightPanel")

          .append("img")

          .attr("src", d.company_logo)

          .attr("alt", `${d.company_name} logo`)

          .attr("width", "200")
          // This class is used in the CSS to style the company logo inside the panel
          .attr("class", "company_logo_panel")

        d3.select("#rightPanel").append("h4").text(`Company: ${d.company_name}`)

        // Creates the paragraph

        const p = d3.select("#rightPanel").append("p")

        p.append("span")

          .text(`Type of Company: `)

          .attr("class", "type_of_company_panel_header")

        // Split the type_of_company string into an array

        const typesOfCompany = d.type_of_company.split(", ")

        // For each type of company, append a clickable span

        typesOfCompany.forEach((type, index) => {
          if (index !== 0) {
            // If it's not the first company type, prepend a comma and a space as to not line the company types right after each other and as to not create a comma and space in front of the first company type

            p.append("span").text(", ")
          }

          // Makes the company types clickable in order to filter on click
          p.append("span")

            .attr("class", "type_of_company_panel_text")

            .style("cursor", "pointer")

            .style("text-decoration", "none")

            .text(type)

            // Adds the filter click event
            .on("click", function () {
              // Set the filterState to the clicked type_of_company

              filterState.type_of_company = type

              // Call the applyFilters function

              applyFilters()

              // Reset the dropdown to match the selected type of company

              companyTypeSelect.property("value", type)
            })
        })

        // Adds all the company data into the rightPanel on click. All following classes are being used in the CSS in order to style the content
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

          // Adds two line breaks after every full stop in the mission statement JSON
          .html(d.mission_statement.replace(/\./g, ".<br><br>"))

        // All companies do not have websites, this makes sure that those who have get their website link connected. This also uses a class for styling in the CSS
        if (d.company_website) {
          d3.select("#rightPanel")

            .append("a")

            .attr("href", d.company_website)

            .attr("target", "_blank")

            .attr("class", "websiteButton")

            .text("Visit Website")
        }
        // If nodes do not have size_in_visualization = medium, visibility of nodes can change on click to create an animation
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

        // Toggles the ecosystems on click as to show or not show the connected nodes. Only for BVH_Companies and BVH_Alumni so far.
        if (
          d.id === "BioVentureHub" ||
          d.id === "BVH_Companies" ||
          d.id === "BVH_Alumni" ||
          d.id === "USP"
        ) {
          if (d.id === "BioVentureHub") {
            if (bvhCompaniesNode.isVisible && companiesNode.isVisible) {
            }

            if (bvhAlumniNode.isVisible && alumniCompNode.isVisible) {
              toggle_ecosystem("Alumni")
            }

            bvhCompaniesNode.isVisible = !bvhCompaniesNode.isVisible

            bvhUspNode.isVisible = !bvhUspNode.isVisible

            bvhAlumniNode.isVisible = !bvhAlumniNode.isVisible

            // Creates the same animation for the links
            data.links.forEach((link) => {
              updateLinkVisibility(link)
            })
          }

          if (d.id === "BVH_Companies") {
            toggle_ecosystem("BioVentureHub")
          }

          if (d.id === "BVH_Alumni") {
            toggle_ecosystem("Alumni")
          }

          // update node display for the toggle

          nodes.style("display", (d) => (d.isVisible ? "inline" : "none"))

          // update link display for the toggle

          links.style("display", (d) => (d.isVisible ? "inline" : "none"))
        }
      }
    })

    // If links both source and target node are visible, the link is visible too.
    function updateLinkVisibility(d) {
      if (d.source.isVisible && d.target.isVisible) {
        d.isVisible = true
      } else {
        d.isVisible = false
      }
    }

    // Creates the animation that makes nodes visible or not visible when their ecosystem nodes are clicked. The main nodes
    function toggle_ecosystem(ecoSys) {
      for (let i = 0; i < data.nodes.length; i++) {
        if (
          data.nodes[i].ecosystem == ecoSys &&
          data.nodes[i].size_in_visualization == "medium"
        ) {
          // Toggle node visibility

          data.nodes[i].isVisible = !data.nodes[i].isVisible

          // Select the node that is being toggled and apply the animation

          d3.select("#graph")

            .selectAll(".node")

            .filter((node) => node.id === data.nodes[i].id)

            .style("opacity", 0)

            .transition()

            .duration(2000)

            .style("opacity", data.nodes[i].isVisible ? 1 : 0)
        }

        // Same for the links
        for (let i = 0; i < data.links.length; i++) {
          link_state = data.links[i].isVisible

          updateLinkVisibility(data.links[i])

          if (data.links[i].isVisible !== link_state) {
            d3.select("#graph")

              .selectAll(".solid")

              .filter((link) => link.index === data.links[i].index)

              .style("opacity", 0)

              .transition()

              .duration(2000)

              .style("opacity", data.links[i].isVisible ? 0.6 : 0)
          }
        }
      }
    }

    // Updates the node and link positions on each tick of the simulation

    simulation.on("tick", () => {
      links

        .attr("x1", (d) => d.source.x)

        .attr("y1", (d) => d.source.y)

        .attr("x2", (d) => d.target.x)

        .attr("y2", (d) => d.target.y)

      nodes.attr("cx", (d) => d.x).attr("cy", (d) => d.y)

      labels.attr("x", (d) => d.x + 10).attr("y", (d) => d.y - 10)

      data.nodes[1].y = bvhY

      data.nodes[1].x = bvhX
    })
  })

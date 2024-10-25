const { entrypoints } = require("uxp");
const triggerButton = document.querySelector("#trigger");

const clearData = () => {
  const title = document.querySelector("#title");
  const output = document.querySelector("#output");
  const ul = document.querySelector("#list");
  const warning = document.querySelector("#warning");

  warning.style.display = "none";
  title.textContent = "";
  output.textContent = "";
  ul.innerHTML = "";
};

const showMissingFontsInfo = (documentId, documentName, missingFonts) => {
  clearData();
  const title = document.querySelector("#title");
  const output = document.querySelector("#output");
  const ul = document.querySelector("#list");

  title.textContent = `Document: ${documentName}`;
  output.textContent = `Missing Fonts: ${missingFonts.length}`;

  missingFonts.forEach((font) => {
    const li = document.createElement("li");
    li.textContent = font;
    ul.appendChild(li);
  });
};

const showWarningMessage = () => {
  clearData();
  const warning = document.querySelector("#warning");
  warning.style.display = "block";
}

triggerButton.onclick = async () => {
  const { id, name, psNames, isActive = false } = await checkForMissingFonts();

  if (!isActive) {
    showWarningMessage();
    return;
  }

  showMissingFontsInfo(id, name, psNames);
};

entrypoints.setup({
   // {
    //   "type": "command",
    //   "id": "checkForMissingFonts",
    //   "label": "check Missing Fonts"
    // },
  // commands: {
  //   checkForMissingFonts,
  // },
  panels: {
    "missing-fonts": {
      show() {
        // panel is already populated from the HTML; do nothing
      },
      menuItems: [
        {id: "check Missing Fonts", label: "Show Missing Fonts"}
      ],
      invokeMenu(id) {
        console.log("Menu clicked", id);
      }
    }
  }
});

function uniqArray(arr) {
  const set = new Set(arr);
  return Array.from(set);
}

function getDocumentDetails(documentId) {
  const batchPlay = require("photoshop").action.batchPlay;
  return batchPlay(
    [
      {
        _obj: "get",
        _target: [
          {
            _ref: "document",
            _id: documentId,
          },
        ],
        _options: {
          dialogOptions: "dontDisplay",
        },
      },
    ],
    {
      synchronousExecution: false,
      modalBehavior: "fail",
    }
  );
}

function getLayerDetails(documentId, layerId) {
  const batchPlay = require("photoshop").action.batchPlay;
  return batchPlay(
    [
      {
        _obj: "get",
        _target: [
          {
            _ref: "layer",
            _id: layerId,
          },
          {
            _ref: "document",
            _id: documentId,
          },
        ],
        _options: {
          dialogOptions: "dontDisplay",
        },
      },
    ],
    {
      synchronousExecution: false,
      modalBehavior: "fail",
    }
  );
}

function getPsNamesFromLayerDetail(layerDetails) {
  const [layerDetail] = layerDetails
  const textStyleRange = layerDetail?.textKey?.textStyleRange ?? [];
  const fontPsNames = textStyleRange.map(x => x?.textStyle?.fontPostScriptName ?? "");

  return fontPsNames.filter((x) => {
    return x !== undefined && x !== null && x.trim() !== "";
  })
}

function getMissingFonts(usedFonts) {
  const app = require("photoshop").app;
  const availableFonts = app.fonts;
  const missingPsNames = [];

  for (let font of usedFonts) {
    const isFontAvailable = availableFonts.some((f) => f.postScriptName === font);

    if (!isFontAvailable) {
      missingPsNames.push(font);
    }
  }

  return missingPsNames;
}

async function checkForMissingFonts() {
  const app = require("photoshop").app;
  const doc = app.activeDocument;

  if (!doc) {
    return {
      isActive: false,
    };
  }
  
  const textLayers = doc.layers.filter((layer) => layer.kind === "text");
  const promisesForLayerDetails = textLayers.map((layer) =>
    getLayerDetails(doc.id, layer.id)
  );
  const layerDetails = await Promise.all(promisesForLayerDetails);
  const fontPsNames = layerDetails.map(getPsNamesFromLayerDetail).flat();
  const uniqueFontPsNames = uniqArray(fontPsNames);
  const missingPsNames = getMissingFonts(uniqueFontPsNames);

  return {
    id: doc.id,
    name: doc.name,
    psNames: missingPsNames,
    isActive: true,
  };
}

require("photoshop").action.addNotificationListener(
  [
    {
      event: "open",
    },
  ],
  checkForMissingFonts
);

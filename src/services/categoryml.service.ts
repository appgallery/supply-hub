import { create } from "xmlbuilder2";

export const generateCategoryXML = (categories: any[]) => {

    const root = create({ version: "1.0" })
        .ele("ENVELOPE");

    root
        .ele("HEADER")
        .ele("TALLYREQUEST")
        .txt("Import Data")
        .up()
        .up();

    const importData = root
        .ele("BODY")
        .ele("IMPORTDATA");

    // Required by Tally
    importData
        .ele("REQUESTDESC")
        .ele("REPORTNAME")
        .txt("All Masters")
        .up()
        .up();


    const requestData = importData
        .ele("REQUESTDATA");


    categories.forEach((category) => {

        requestData
            .ele("TALLYMESSAGE", {
                xmlns: "TallyUDF"
            })
            .ele("STOCKGROUP", {
                NAME: category.categoryName,
                ACTION: "Create"
            })
            .ele("NAME")
            .txt(category.categoryName)
            .up()
            .ele("PARENT")
            .txt("")
            .up()
            .up()
            .up();
    });

    return root.end({
        prettyPrint: true
    });
};
import axios from "axios";

export const sendCategoryXmlToTally = async (xml: string) => {
    try {
        const response = await axios.post(
            "http://192.168.1.108:9000",
            xml,
            {
                headers: {
                    "Content-Type": "text/xml"
                }
            }
        );

        console.log("Tally Response:", response.data);

        return response.data;

    } catch (error: any) {
        console.log(
            "Tally Error:",
            error.response?.data || error.message
        );

        throw new Error("Failed to send XML to Tally");
    }
};

export const generateReadCategoryXML = () => {
    return `
<?xml version="1.0"?>

<ENVELOPE>

    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Collection</TYPE>
        <ID>Stock Groups</ID>
    </HEADER>

    <BODY>
        <DESC>

            <STATICVARIABLES>
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            </STATICVARIABLES>

            <TDL>
                <TDLMESSAGE>

                    <COLLECTION NAME="Stock Groups">
                        <TYPE>Stock Group</TYPE>

                        <FETCH>
                            Name,
                            Parent
                        </FETCH>

                    </COLLECTION>

                </TDLMESSAGE>
            </TDL>

        </DESC>
    </BODY>

</ENVELOPE>
`;
};

// export const readCategoriesFromTallyService = async () => {
//     const xml = generateReadCategoryXML();

//     console.log(xml);

//     const response = await axios.post(
//         "http://192.168.1.108:9000",
//         xml,
//         {
//             headers: {
//                 "Content-Type": "text/xml"
//             }
//         }
//     );

//     return response.data;
// };
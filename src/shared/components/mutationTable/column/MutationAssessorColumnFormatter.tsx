import * as React from 'react';
import DefaultTooltip from 'shared/components/DefaultTooltip';
import {Td} from 'reactable';
import {IColumnFormatterData} from "shared/components/enhancedReactTable/IColumnFormatter";
import 'rc-tooltip/assets/bootstrap_white.css';
import styles from "./mutationAssessor.module.scss";
import {MutationTableRowData} from "../IMutationTableProps";
import {Mutation} from "shared/api/generated/CBioPortalAPI";
import {compareNumberLists} from "shared/lib/SortUtils";

type MA_CLASS_NAME = 'oma-high' | 'oma-medium' | 'oma-low' | 'oma-neutral' | 'oma-na';

export interface IMutationAssessorFormat
{
    label: string;
    className: MA_CLASS_NAME;
    priority: number;
}

/**
 * @author Selcuk Onur Sumer
 */
export default class MutationAssessorColumnFormatter
{
    /**
     * Mapping between the functional impact score (data) values and
     * view values.
     */
    public static get MA_SCORE_MAP():{[impact:string]: IMutationAssessorFormat} {
        return {
            h: {label: "High", className: "oma-high", priority: 4},
            m: {label: "Medium", className: "oma-medium", priority: 3},
            l: {label: "Low", className: "oma-low", priority: 2},
            n: {label: "Neutral", className: "oma-neutral", priority: 1},
            na: {label: "NA", className: "oma-na", priority: 0},
        };
    }

    public static sortFunction(a:IColumnFormatterData<MutationTableRowData>, b:IColumnFormatterData<MutationTableRowData>):number
    {
        const aScore:number = MutationAssessorColumnFormatter.getData(a).score;
        const bScore:number = MutationAssessorColumnFormatter.getData(b).score;

        const aFormat:IMutationAssessorFormat|undefined = MutationAssessorColumnFormatter.getMapEntry(a);
        const bFormat:IMutationAssessorFormat|undefined = MutationAssessorColumnFormatter.getMapEntry(b);

        const aPriority:number = aFormat ? aFormat.priority : -1;
        const bPriority:number = bFormat ? bFormat.priority : -1;

        // first sort by priority, then sort by score
        return compareNumberLists([aPriority, aScore], [bPriority, bScore]);
    }

    public static filterValue(data:IColumnFormatterData<MutationTableRowData>):string
    {
        return MutationAssessorColumnFormatter.getDisplayValue(data);
    }

    /**
     * Determines the display value by using the impact field.
     *
     * @param data  column formatter data
     * @returns {string}    mutation assessor text value
     */
    public static getDisplayValue(data:IColumnFormatterData<MutationTableRowData>):string
    {
        const entry:IMutationAssessorFormat|undefined =
            MutationAssessorColumnFormatter.getMapEntry(data);

        // first, try to find a mapped value
        if (entry) {
            return entry.label;
        }
        // if no mapped value, then return the text value as is
        else {
            return MutationAssessorColumnFormatter.getTextValue(data);
        }
    }

    public static getTextValue(data:IColumnFormatterData<MutationTableRowData>):string
    {
        const maData = MutationAssessorColumnFormatter.getData(data);

        // return impact value (if exists)
        if (maData && maData.impact) {
            return maData.impact.toString();
        }
        else {
            return "";
        }
    }

    public static getScoreClassName(data:IColumnFormatterData<MutationTableRowData>):string
    {
        const value:IMutationAssessorFormat|undefined =
            MutationAssessorColumnFormatter.getMapEntry(data);

        if (value) {
            return value.className;
        }
        else {
            return "";
        }
    }

    public static getMaClassName(data:IColumnFormatterData<MutationTableRowData>):string
    {
        const value:IMutationAssessorFormat|undefined =
            MutationAssessorColumnFormatter.getMapEntry(data);

        if (value) {
            return "oma-link";
        }
        else {
            return "";
        }
    }

    public static getMapEntry(data:IColumnFormatterData<MutationTableRowData>)
    {
        const maData = MutationAssessorColumnFormatter.getData(data);

        if (maData && maData.impact) {
            return MutationAssessorColumnFormatter.MA_SCORE_MAP[maData.impact.toLowerCase()];
        }
        else {
            return undefined;
        }
    }

    public static getData(data:IColumnFormatterData<MutationTableRowData>)
    {
        let maData;

        if (data.columnData)
        {
            maData = data.columnData;
        }
        else if (data.rowData)
        {
            const mutations:Mutation[] = data.rowData;

            if (mutations.length > 0) {
                maData = {
                    impact: mutations[0].functionalImpactScore,
                    score: mutations[0].fisValue,
                    pdb: mutations[0].linkPdb,
                    msa: mutations[0].linkMsa,
                    xVar: mutations[0].linkXvar
                };
            } else {
                maData = {};
            }
        }
        else {
            maData = {};
        }

        return maData;
    }

    public static getTooltipContent(data:IColumnFormatterData<MutationTableRowData>)
    {
        const maData = MutationAssessorColumnFormatter.getData(data);
        let xVar:any = "";
        let msa:any = "";
        let pdb:any = "";
        let impact:any = "";

        // workaround: links in the database are not working anymore!
        const xVarLink = MutationAssessorColumnFormatter.maLink(maData.xVar);
        const msaLink = MutationAssessorColumnFormatter.maLink(maData.msa);
        const pdbLink = MutationAssessorColumnFormatter.maLink(maData.pdb);

        if (maData.score)
        {
            impact = (
                <div>
                    Predicted impact score: <b>{maData.score.toFixed(2)}</b>
                </div>
            );
        }

        if (xVarLink)
        {
            xVar = (
                <div className={styles['mutation-assessor-link']}>
                    <a href={xVarLink} target='_blank'>
                        <img
                            height='15'
                            width='19'
                            src={require("./mutationAssessor.png")}
                            className={styles['mutation-assessor-main-img']}
                            alt='Mutation Assessor'
                        />
                        Go to Mutation Assessor
                    </a>
                </div>
            );
        }

        if (msaLink)
        {
            msa = (
                <div className={styles['mutation-assessor-link']}>
                    <a href={msaLink} target='_blank'>
                        <span className={`${styles['ma-icon']} ${styles['ma-msa-icon']}`}>msa</span>
                        Multiple Sequence Alignment
                    </a>
                </div>
            );
        }

        if (pdbLink)
        {
            pdb = (
                <div className={styles['mutation-assessor-link']}>
                    <a href={pdbLink} target='_blank'>
                        <span className={`${styles['ma-icon']} ${styles['ma-3d-icon']}`}>3D</span>
                        Mutation Assessor 3D View
                    </a>
                </div>
            );
        }

        return (
            <span>
                {impact}
                {xVar}
                {msa}
                {pdb}
            </span>
        );
    }

    // This is mostly to make the legacy MA links work
    public static maLink(link:string)
    {
        let url = null;

        // ignore invalid links ("", "NA", "Not Available")
        if (link &&
            link.length > 0 &&
            link.toLowerCase() !== "na" &&
            link.toLowerCase().indexOf("not available") === -1)
        {
            // getma.org is the legacy link, need to replace it with the actual value
            url = link.replace("getma.org", "mutationassessor.org/r2");

            // prepend "http://" if needed
            if (url.indexOf("http://") !== 0)
            {
                url = `http://${url}`;
            }
        }

        return url;
    }

    public static renderFunction(data:IColumnFormatterData<MutationTableRowData>)
    {
        const NA:string = MutationAssessorColumnFormatter.MA_SCORE_MAP["na"].label;

        const text:string = MutationAssessorColumnFormatter.getDisplayValue(data);
        const fisClass:string = MutationAssessorColumnFormatter.getScoreClassName(data);
        const maClass:string = MutationAssessorColumnFormatter.getMaClassName(data);

        let content = (
            <span className={`${styles[maClass]} ${styles[fisClass]}`}>{text}</span>
        );

        // add tooltip for valid values
        if (text.length > 0 && text !== NA)
        {
            const arrowContent = <div className="rc-tooltip-arrow-inner"/>;
            const tooltipContent = MutationAssessorColumnFormatter.getTooltipContent(data);

            // update content with the tooltip
            content = (
                <DefaultTooltip overlay={tooltipContent} placement="left" arrowContent={arrowContent}>
                    {content}
                </DefaultTooltip>
            );
        }

        // this is required to have a proper filtering when we pass a complex object as Td.value
        data.toString = function() {
            return MutationAssessorColumnFormatter.filterValue(data);
        };

        return (
            <Td key={data.name} column={data.name} value={data}>
                {content}
            </Td>
        );
    }
}

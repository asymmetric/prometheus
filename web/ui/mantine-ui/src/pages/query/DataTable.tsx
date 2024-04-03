import { FC, useEffect, useId } from "react";
import { Table, Alert, Skeleton, Box, LoadingOverlay } from "@mantine/core";
import { IconAlertTriangle, IconInfoCircle } from "@tabler/icons-react";
import {
  InstantQueryResult,
  InstantSample,
  RangeSamples,
} from "../../api/responseTypes/query";
import SeriesName from "./SeriesName";
import { useAPIQuery } from "../../api/api";
import classes from "./DataTable.module.css";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import { useAppSelector } from "../../state/hooks";
import { formatTimestamp } from "../../lib/formatTime";
dayjs.extend(timezone);

const maxFormattableSeries = 1000;
const maxDisplayableSeries = 10000;

const limitSeries = <S extends InstantSample | RangeSamples>(
  series: S[]
): S[] => {
  if (series.length > maxDisplayableSeries) {
    return series.slice(0, maxDisplayableSeries);
  }
  return series;
};

export interface DataTableProps {
  expr: string;
  evalTime: number | null;
  retriggerIdx: number;
}

const DataTable: FC<DataTableProps> = ({ expr, evalTime, retriggerIdx }) => {
  const { data, error, isFetching, isLoading, refetch } =
    useAPIQuery<InstantQueryResult>({
      key: useId(),
      path: "/query",
      params: {
        query: expr,
        time: `${(evalTime !== null ? evalTime : Date.now()) / 1000}`,
      },
      enabled: expr !== "",
    });

  useEffect(() => {
    expr !== "" && refetch();
  }, [retriggerIdx, refetch, expr, evalTime]);

  const useLocalTime = useAppSelector((state) => state.settings.useLocalTime);

  // Show a skeleton only on the first load, not on subsequent ones.
  if (isLoading) {
    return (
      <Box>
        {Array.from(Array(5), (_, i) => (
          <Skeleton key={i} height={30} mb={15} />
        ))}
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        color="red"
        title="Error executing query"
        icon={<IconAlertTriangle size={14} />}
      >
        {error.message}
      </Alert>
    );
  }

  if (data === undefined) {
    return <Alert variant="transparent">No data queried yet</Alert>;
  }

  const { result, resultType } = data.data;

  if (result.length === 0) {
    return (
      <Alert title="Empty query result" icon={<IconInfoCircle size={14} />}>
        This query returned no data.
      </Alert>
    );
  }

  const doFormat = result.length <= maxFormattableSeries;

  return (
    <Box pos="relative" className={classes.tableWrapper}>
      <LoadingOverlay
        visible={isFetching}
        zIndex={1000}
        overlayProps={{ radius: "sm", blur: 1 }}
        loaderProps={{
          children: <Skeleton m={0} w="100%" h="100%" />,
        }}
        styles={{ loader: { width: "100%", height: "100%" } }}
      />
      <Table highlightOnHover fz="xs">
        <Table.Tbody>
          {resultType === "vector" ? (
            limitSeries<InstantSample>(result).map((s, idx) => (
              <Table.Tr key={idx}>
                <Table.Td>
                  <SeriesName labels={s.metric} format={doFormat} />
                </Table.Td>
                <Table.Td className={classes.numberCell}>
                  {s.value && s.value[1]}
                  {s.histogram && "TODO HISTOGRAM DISPLAY"}
                </Table.Td>
              </Table.Tr>
            ))
          ) : resultType === "matrix" ? (
            limitSeries<RangeSamples>(result).map((s, idx) => (
              <Table.Tr key={idx}>
                <Table.Td>
                  <SeriesName labels={s.metric} format={doFormat} />
                </Table.Td>
                <Table.Td className={classes.numberCell}>
                  {s.values &&
                    s.values.map((v, idx) => (
                      <div key={idx}>
                        {v[1]} @{" "}
                        {
                          <span title={formatTimestamp(v[0], useLocalTime)}>
                            {v[0]}
                          </span>
                        }
                      </div>
                    ))}
                </Table.Td>
              </Table.Tr>
            ))
          ) : resultType === "scalar" ? (
            <Table.Tr>
              <Table.Td>Scalar value</Table.Td>
              <Table.Td className={classes.numberCell}>{result[1]}</Table.Td>
            </Table.Tr>
          ) : resultType === "string" ? (
            <Table.Tr>
              <Table.Td>String value</Table.Td>
              <Table.Td>{result[1]}</Table.Td>
            </Table.Tr>
          ) : (
            <Alert
              color="red"
              title="Invalid query response"
              icon={<IconAlertTriangle size={14} />}
            >
              Invalid result value type
            </Alert>
          )}
        </Table.Tbody>
      </Table>
    </Box>
  );
};

export default DataTable;
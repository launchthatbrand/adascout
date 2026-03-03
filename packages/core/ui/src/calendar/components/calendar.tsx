"use client";

import "../styles/calendar.css";

import type {
  DateSelectArg,
  DayCellContentArg,
  DayHeaderContentArg,
  EventChangeArg,
  EventClickArg,
  EventContentArg,
} from "@fullcalendar/core/index.js";
import { earliestTime, latestTime } from "../utils/data";
import { useRef, useState } from "react";

import type { CalendarEvent } from "../utils/data";
import CalendarNav from "./calendar-nav";
import { Card } from "./ui/card";
import { EventEditForm } from "./event-edit-form";
import { EventView } from "./event-view";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import { getDateFromMinutes } from "../lib/utils";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import multiMonthPlugin from "@fullcalendar/multimonth";
import timeGridPlugin from "@fullcalendar/timegrid";
import { useEvents } from "../context/events-context";

interface EventItemProps {
  info: EventContentArg;
}

interface DayHeaderProps {
  info: DayHeaderContentArg;
}

interface DayRenderProps {
  info: DayCellContentArg;
}

interface EventExtendedProps {
  description?: string;
}

export interface CalendarProps {
  /**
   * External events to display (optional)
   * If provided, these will be used instead of the context events
   */
  externalEvents?: CalendarEvent[];

  /**
   * Function to handle event click
   * If provided, this will be called instead of opening the event view modal
   */
  onEventClick?: (event: CalendarEvent) => void;

  /**
   * Function to handle slot selection (creating a new event)
   * If provided, this will be called instead of opening the event add form
   */
  onSlotSelect?: (slotInfo: { start: Date; end: Date }) => void;

  /**
   * Default view for the calendar
   */
  defaultView?: "timeGridDay" | "timeGridWeek" | "dayGridMonth" | "listWeek";

  /**
   * Whether to show the add event button in the CalendarNav component
   */
  showAddEventButton?: boolean;
}

export default function Calendar({
  externalEvents,
  onEventClick,
  onSlotSelect,
  defaultView = "timeGridWeek",
  showAddEventButton = true,
}: CalendarProps = {}) {
  const {
    events: contextEvents,
    setEventAddOpen,
    setEventEditOpen,
    setEventViewOpen,
  } = useEvents();

  // Use external events if provided, otherwise use context events
  const events = externalEvents ?? contextEvents;

  const calendarRef = useRef<FullCalendar | null>(null);
  const [viewedDate, setViewedDate] = useState(new Date());
  const [selectedStart, setSelectedStart] = useState(new Date());
  const [selectedEnd, setSelectedEnd] = useState(new Date());
  const [selectedOldEvent, setSelectedOldEvent] = useState<
    CalendarEvent | undefined
  >();
  const [selectedEvent, setSelectedEvent] = useState<
    CalendarEvent | undefined
  >();
  const [isDrag, setIsDrag] = useState(false);

  const handleEventClick = (info: EventClickArg) => {
    const extendedProps = info.event.extendedProps as EventExtendedProps;

    const event: CalendarEvent = {
      id: info.event.id,
      title: info.event.title,
      description: extendedProps.description ?? "",
      backgroundColor: info.event.backgroundColor ?? "#AEC6E4",
      start: info.event.start ?? new Date(),
      end: info.event.end ?? new Date(),
    };

    if (onEventClick) {
      // Use external handler if provided
      onEventClick(event);
    } else {
      // Use default behavior
      setIsDrag(false);
      setSelectedOldEvent(event);
      setSelectedEvent(event);
      setEventViewOpen(true);
    }
  };

  const handleEventChange = (info: EventChangeArg) => {
    const extendedProps = info.event.extendedProps as EventExtendedProps;
    const oldExtendedProps = info.oldEvent.extendedProps as EventExtendedProps;

    const event: CalendarEvent = {
      id: info.event.id,
      title: info.event.title,
      description: extendedProps.description ?? "",
      backgroundColor: info.event.backgroundColor ?? "#AEC6E4",
      start: info.event.start ?? new Date(),
      end: info.event.end ?? new Date(),
    };

    const oldEvent: CalendarEvent = {
      id: info.oldEvent.id,
      title: info.oldEvent.title,
      description: oldExtendedProps.description ?? "",
      backgroundColor: info.oldEvent.backgroundColor ?? "#AEC6E4",
      start: info.oldEvent.start ?? new Date(),
      end: info.oldEvent.end ?? new Date(),
    };

    setIsDrag(true);
    setSelectedOldEvent(oldEvent);
    setSelectedEvent(event);
    setEventEditOpen(true);
  };

  const EventItem = ({ info }: EventItemProps) => {
    const { event } = info;
    const [left, right] = info.timeText.split(" - ");

    return (
      <div className="w-full overflow-hidden">
        {info.view.type == "dayGridMonth" ? (
          <div
            style={{ backgroundColor: info.backgroundColor }}
            className={`line-clamp-1 flex w-full flex-col rounded-md px-2 py-1 text-[0.5rem] sm:text-[0.6rem] md:text-xs`}
          >
            <p className="line-clamp-1 w-11/12 font-semibold text-gray-950">
              {event.title}
            </p>

            <p className="text-gray-800">{left}</p>
            <p className="text-gray-800">{right}</p>
          </div>
        ) : (
          <div className="flex flex-col space-y-0 text-[0.5rem] sm:text-[0.6rem] md:text-xs">
            <p className="leading-1 line-clamp-1 w-full text-[0.5rem] font-semibold text-gray-950 sm:text-[0.6rem] md:text-xs">
              {event.title}
            </p>
            <p className="line-clamp-1 text-[0.5rem] text-gray-800 sm:text-[0.6rem] md:text-xs">{`${left} - ${right}`}</p>
          </div>
        )}
      </div>
    );
  };

  const DayHeader = ({ info }: DayHeaderProps) => {
    const [weekday] = info.text.split(" ");

    return (
      <div className="flex h-full items-center overflow-hidden">
        {info.view.type == "timeGridDay" ? (
          <div className="flex flex-col rounded-sm">
            <p>
              {info.date.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        ) : info.view.type == "timeGridWeek" ? (
          <div className="md:text-md flex w-full flex-col items-center space-y-0.5 rounded-sm text-xs sm:text-sm">
            <p className="flex font-semibold">{weekday}</p>
            {info.isToday ? (
              <div className="md:text-md flex h-6 w-6 items-center justify-center rounded-full bg-black text-xs dark:bg-white sm:text-sm">
                <p className="font-light text-white dark:text-black">
                  {info.date.getDate()}
                </p>
              </div>
            ) : (
              <div className="h-6 w-6 items-center justify-center rounded-full">
                <p className="font-light">{info.date.getDate()}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col rounded-sm">
            <p>{weekday}</p>
          </div>
        )}
      </div>
    );
  };

  const DayRender = ({ info }: DayRenderProps) => {
    return (
      <div className="flex">
        {info.view.type == "dayGridMonth" && info.isToday ? (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-sm text-white dark:bg-white dark:text-black">
            {info.dayNumberText}
          </div>
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full text-sm">
            {info.dayNumberText}
          </div>
        )}
      </div>
    );
  };

  const handleDateSelect = (info: DateSelectArg) => {
    setSelectedStart(info.start);
    setSelectedEnd(info.end);

    if (onSlotSelect) {
      // Use external handler if provided
      onSlotSelect({ start: info.start, end: info.end });
    } else if (!onSlotSelect && !showAddEventButton) {
      // If no external handler and add event button is hidden, do nothing
      return;
    } else {
      // Otherwise use default behavior - will trigger event add form via the dateClick handler
      setEventAddOpen(true);
    }
  };

  const earliestHour = getDateFromMinutes(earliestTime)
    .getHours()
    .toString()
    .padStart(2, "0");
  const earliestMin = getDateFromMinutes(earliestTime)
    .getMinutes()
    .toString()
    .padStart(2, "0");
  const latestHour = getDateFromMinutes(latestTime)
    .getHours()
    .toString()
    .padStart(2, "0");
  const latestMin = getDateFromMinutes(latestTime)
    .getMinutes()
    .toString()
    .padStart(2, "0");

  const calendarEarliestTime = `${earliestHour}:${earliestMin}`;
  const calendarLatestTime = `${latestHour}:${latestMin}`;

  return (
    <div className="space-y-5">
      <CalendarNav
        calendarRef={calendarRef}
        start={selectedStart}
        end={selectedEnd}
        viewedDate={viewedDate}
        showAddEventButton={showAddEventButton}
      />

      <Card className="p-0">
        <FullCalendar
          ref={calendarRef}
          timeZone="local"
          plugins={[
            dayGridPlugin,
            timeGridPlugin,
            multiMonthPlugin,
            interactionPlugin,
            listPlugin,
          ]}
          initialView={defaultView}
          headerToolbar={false}
          slotMinTime={calendarEarliestTime}
          slotMaxTime={calendarLatestTime}
          allDaySlot={false}
          firstDay={1}
          height={"32vh"}
          displayEventEnd={true}
          windowResizeDelay={0}
          events={events}
          slotLabelFormat={{
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }}
          eventTimeFormat={{
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }}
          eventBorderColor={"black"}
          contentHeight={"auto"}
          expandRows={true}
          dayCellContent={(dayInfo) => <DayRender info={dayInfo} />}
          eventContent={(eventInfo) => <EventItem info={eventInfo} />}
          dayHeaderContent={(headerInfo) => <DayHeader info={headerInfo} />}
          eventClick={(eventInfo) => handleEventClick(eventInfo)}
          eventChange={(eventInfo) => handleEventChange(eventInfo)}
          select={handleDateSelect}
          datesSet={(dates) => setViewedDate(dates.view.currentStart)}
          dateClick={() => {
            if (!onSlotSelect) {
              setEventAddOpen(true);
            }
          }}
          nowIndicator
          editable
          selectable
        />
      </Card>
      {!onEventClick && (
        <>
          <EventEditForm
            oldEvent={selectedOldEvent}
            event={selectedEvent}
            isDrag={isDrag}
            displayButton={false}
          />
          <EventView event={selectedEvent} />
        </>
      )}
    </div>
  );
}

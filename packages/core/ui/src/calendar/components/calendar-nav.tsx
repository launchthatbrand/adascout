"use client";

import { useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  GalleryVertical,
  List,
  Table,
  Tally3,
} from "lucide-react";

import { cn } from "../../lib/utils";
import { Button } from "@acme/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@acme/ui/command";
import { Input } from "@acme/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@acme/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@acme/ui/tabs";

import type { calendarRef } from "../utils/data";
import {
  generateDaysInMonth,
  goNext,
  goPrev,
  goToday,
  handleDayChange,
  handleMonthChange,
  handleYearChange,
  setView,
} from "../utils/calendar-utils";
import { months } from "../utils/data";
import { EventAddForm } from "./event-add-form";

interface CalendarNavProps {
  calendarRef: calendarRef;
  start: Date;
  end: Date;
  viewedDate: Date;
  showAddEventButton?: boolean;
}

export default function CalendarNav({
  calendarRef,
  start,
  end,
  viewedDate,
  showAddEventButton = true,
}: CalendarNavProps) {
  const [currentView, setCurrentView] = useState("timeGridWeek");

  const selectedMonth = viewedDate.getMonth() + 1;
  const selectedDay = viewedDate.getDate();
  const selectedYear = viewedDate.getFullYear();

  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const dayOptions = generateDaysInMonth(daysInMonth);

  const [daySelectOpen, setDaySelectOpen] = useState(false);
  const [monthSelectOpen, setMonthSelectOpen] = useState(false);

  return (
    <div className="flex min-w-full flex-wrap justify-center gap-3 px-10">
      <div className="flex flex-row space-x-1">
        {/* Navigate to previous date interval */}

        <Button
          variant="ghost"
          className="w-8"
          onClick={() => {
            goPrev(calendarRef);
          }}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Day Lookup */}

        {currentView == "timeGridDay" && (
          <Popover open={daySelectOpen} onOpenChange={setDaySelectOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-20 justify-between text-xs font-semibold"
              >
                {selectedDay
                  ? dayOptions.find((day) => day.value === String(selectedDay))
                      ?.label
                  : "Select day..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[200px] p-0">
              <Command>
                <CommandInput placeholder="Search day..." />
                <CommandList>
                  <CommandEmpty>No day found.</CommandEmpty>
                  <CommandGroup>
                    {dayOptions.map((day) => (
                      <CommandItem
                        key={day.value}
                        value={day.value}
                        onSelect={(currentValue) => {
                          handleDayChange(
                            calendarRef,
                            viewedDate,
                            currentValue,
                          );
                          //   setValue(currentValue === selectedMonth ? "" : currentValue);
                          setDaySelectOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            String(selectedDay) === day.value
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        {day.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}

        {/* Month Lookup */}

        <Popover open={monthSelectOpen} onOpenChange={setMonthSelectOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className="flex w-[105px] justify-between overflow-hidden p-2 text-xs font-semibold md:w-[120px] md:text-sm"
            >
              {selectedMonth
                ? months.find((month) => month.value === String(selectedMonth))
                    ?.label
                : "Select month..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0">
            <Command>
              <CommandInput placeholder="Search month..." />
              <CommandList>
                <CommandEmpty>No month found.</CommandEmpty>
                <CommandGroup>
                  {months.map((month) => (
                    <CommandItem
                      key={month.value}
                      value={month.value}
                      onSelect={(currentValue) => {
                        handleMonthChange(
                          calendarRef,
                          viewedDate,
                          currentValue,
                        );
                        //   setValue(currentValue === selectedMonth ? "" : currentValue);
                        setMonthSelectOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          String(selectedMonth) === month.value
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                      {month.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Year Lookup */}

        <Input
          className="w-[75px] text-xs font-semibold md:w-[85px] md:text-sm"
          type="number"
          value={selectedYear}
          onChange={(value) => handleYearChange(calendarRef, viewedDate, value)}
        />

        {/* Navigate to next date interval */}

        <Button
          variant="ghost"
          className="w-8"
          onClick={() => {
            goNext(calendarRef);
          }}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {/* Button to go to current date */}

        <Button
          className="w-[90px] text-xs md:text-sm"
          variant="outline"
          onClick={() => {
            goToday(calendarRef);
          }}
        >
          {currentView === "timeGridDay"
            ? "Today"
            : currentView === "timeGridWeek"
              ? "This Week"
              : currentView === "dayGridMonth"
                ? "This Month"
                : currentView === "listWeek"
                  ? "Today"
                  : null}
        </Button>

        {/* Change view with tabs */}

        <Tabs defaultValue="timeGridWeek">
          <TabsList className="flex w-56 md:w-80">
            <TabsTrigger
              value="timeGridDay"
              onClick={() =>
                setView(calendarRef, "timeGridDay", setCurrentView)
              }
              className={`space-x-1 ${
                currentView === "timeGridDay" ? "w-1/2" : "w-1/5"
              }`}
            >
              <GalleryVertical className="h-5 w-5" />
              {currentView === "timeGridDay" && (
                <p className="text-xs md:text-sm">Day</p>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="timeGridWeek"
              onClick={() =>
                setView(calendarRef, "timeGridWeek", setCurrentView)
              }
              className={`space-x-1 ${
                currentView === "timeGridWeek" ? "w-1/2" : "w-1/5"
              }`}
            >
              <Tally3 className="h-5 w-5" />
              {currentView === "timeGridWeek" && (
                <p className="text-xs md:text-sm">Week</p>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="dayGridMonth"
              onClick={() =>
                setView(calendarRef, "dayGridMonth", setCurrentView)
              }
              className={`space-x-1 ${
                currentView === "dayGridMonth" ? "w-1/2" : "w-1/5"
              }`}
            >
              <Table className="h-5 w-5 rotate-90" />
              {currentView === "dayGridMonth" && (
                <p className="text-xs md:text-sm">Month</p>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="listWeek"
              onClick={() => setView(calendarRef, "listWeek", setCurrentView)}
              className={`space-x-1 ${
                currentView === "listWeek" ? "w-1/2" : "w-1/5"
              }`}
            >
              <List className="h-5 w-5" />
              {currentView === "listWeek" && (
                <p className="text-xs md:text-sm">Agenda</p>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Add event button  */}
        {showAddEventButton && <EventAddForm start={start} end={end} />}
      </div>
    </div>
  );
}

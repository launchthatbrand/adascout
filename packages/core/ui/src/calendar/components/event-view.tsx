import { X } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@acme/ui/alert-dialog";

import type { CalendarEvent } from "../utils/data";
import { useEvents } from "../context/events-context";
import { EventDeleteForm } from "./event-delete-form";
import { EventEditForm } from "./event-edit-form";

interface EventViewProps {
  event?: CalendarEvent;
}

export function EventView({ event }: EventViewProps) {
  const { eventViewOpen, setEventViewOpen } = useEvents();

  return (
    <>
      <AlertDialog open={eventViewOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex flex-row items-center justify-between">
              <span className="text-lg font-semibold">{event?.title}</span>
              <AlertDialogCancel onClick={() => setEventViewOpen(false)}>
                <X className="h-5 w-5" />
              </AlertDialogCancel>
            </AlertDialogTitle>
            <table>
              <tbody>
                <tr>
                  <th>Time:</th>
                  <td>{`${event?.start.toLocaleTimeString()} - ${event?.end.toLocaleTimeString()}`}</td>
                </tr>
                <tr>
                  <th>Description:</th>
                  <td>{event?.description}</td>
                </tr>
                <tr>
                  <th>Color:</th>
                  <td>
                    <div
                      className="h-5 w-5 rounded-full"
                      style={{ backgroundColor: event?.backgroundColor }}
                    ></div>
                  </td>
                </tr>
              </tbody>
            </table>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <EventDeleteForm id={event?.id} title={event?.title} />
            <EventEditForm
              oldEvent={event}
              event={event}
              isDrag={false}
              displayButton={true}
            />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

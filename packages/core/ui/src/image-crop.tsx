"use client"

import React, { type SyntheticEvent } from "react"

import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop"

import { Avatar, AvatarFallback, AvatarImage } from "@acme/ui/avatar"
import { Button } from "./button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@acme/ui/dialog"

import "react-image-crop/dist/ReactCrop.css"

import { CropIcon, Trash2Icon } from "lucide-react"

export type FileWithPreview = {
  preview: string
}
interface ImageCropperProps {
  dialogOpen: boolean
  setDialogOpen: React.Dispatch<React.SetStateAction<boolean>>
  selectedFile: FileWithPreview | null
  setSelectedFile: React.Dispatch<React.SetStateAction<FileWithPreview | null>>
  showTrigger?: boolean
  cropButtonLabel?: string
  onCropped?: (result: {
    dataUrl?: string
    percentCrop: Crop
    pixelCrop?: PixelCrop
  }) => void
}

export function ImageCropper({
  dialogOpen,
  setDialogOpen,
  selectedFile,
  setSelectedFile,
  showTrigger = true,
  cropButtonLabel = "Crop",
  onCropped,
}: ImageCropperProps) {
  const aspect = 1

  const imgRef = React.useRef<HTMLImageElement | null>(null)

  const [crop, setCrop] = React.useState<Crop>()
  const [lastPercentCrop, setLastPercentCrop] = React.useState<Crop>()
  const [lastPixelCrop, setLastPixelCrop] = React.useState<PixelCrop>()
  const [croppedImage, setCroppedImage] = React.useState<string>("")

  function onImageLoad(e: SyntheticEvent<HTMLImageElement>) {
    if (aspect) {
      const { width, height } = e.currentTarget
      const next = centerAspectCrop(width, height, aspect)
      setCrop(next)
      setLastPercentCrop(next)
      console.debug("[ImageCropper] onImageLoad", {
        width,
        height,
        next,
        src: selectedFile?.preview,
      })
    }
  }

  function onCropComplete(crop: PixelCrop) {
    if (imgRef.current && crop.width && crop.height) {
      setLastPixelCrop(crop)
      console.debug("[ImageCropper] onCropComplete", { crop })
    }
  }

  function getCroppedImg(
    image: HTMLImageElement,
    crop: PixelCrop,
  ): string | null {
    const canvas = document.createElement("canvas")
    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height

    canvas.width = crop.width * scaleX
    canvas.height = crop.height * scaleY

    const ctx = canvas.getContext("2d")

    if (ctx) {
      ctx.imageSmoothingEnabled = false

      ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        crop.width * scaleX,
        crop.height * scaleY,
      )
    }

    try {
      return canvas.toDataURL("image/png", 1.0)
    } catch {
      // Likely a cross-origin / tainted canvas. We can still use the crop coords.
      return null
    }
  }

  async function onCrop() {
    try {
      console.debug("[ImageCropper] onCrop click", {
        dialogOpen,
        lastPercentCrop,
        lastPixelCrop,
        hasImg: Boolean(imgRef.current),
      })
      setDialogOpen(false)
      const percentCrop = lastPercentCrop ?? crop
      if (percentCrop) {
        const dataUrl =
          imgRef.current && lastPixelCrop
            ? getCroppedImg(imgRef.current, lastPixelCrop) ?? undefined
            : undefined

        if (dataUrl) setCroppedImage(dataUrl)

        console.debug("[ImageCropper] onCropped firing", {
          percentCrop,
          hasDataUrl: Boolean(dataUrl),
        })
        onCropped?.({
          dataUrl,
          percentCrop,
          pixelCrop: lastPixelCrop,
        })
      } else {
        console.warn("[ImageCropper] onCrop: missing percentCrop")
      }
    } catch (error) {
      console.error("[ImageCropper] onCrop error", error)
      alert("Something went wrong!")
    }
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {showTrigger ? (
        <DialogTrigger type="button">
          <Avatar className="size-36 cursor-pointer ring-offset-2 ring-2 ring-slate-200">
            <AvatarImage
              src={croppedImage ? croppedImage : selectedFile?.preview}
              alt="@shadcn"
            />
            <AvatarFallback>CN</AvatarFallback>
          </Avatar>
        </DialogTrigger>
      ) : null}
      <DialogContent className="p-0 gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Crop image</DialogTitle>
          <DialogDescription>
            Select the square crop region for this image.
          </DialogDescription>
        </DialogHeader>
        <div className="p-6 size-full max-w-md">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => {
              setCrop(percentCrop)
              setLastPercentCrop(percentCrop)
              console.debug("[ImageCropper] onChange", { percentCrop })
            }}
            onComplete={(c) => onCropComplete(c)}
            aspect={aspect}
            className="w-full"
          >
            <Avatar className="size-full rounded-none">
              <AvatarImage
                ref={imgRef}
                className="size-full rounded-none "
                alt="Image Cropper Shell"
                src={selectedFile?.preview}
                onLoad={onImageLoad}
                crossOrigin="anonymous"
              />
              <AvatarFallback className="size-full min-h-[460px] rounded-none">
                Loading...
              </AvatarFallback>
            </Avatar>
          </ReactCrop>
        </div>
        <DialogFooter className="p-6 pt-0 justify-center ">
          <DialogClose asChild>
            <Button
              size={"sm"}
              type="reset"
              className="w-fit"
              variant={"outline"}
              onClick={() => {
                setSelectedFile(null)
              }}
            >
              <Trash2Icon className="mr-1.5 size-4" />
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            size={"sm"}
            className="w-fit"
            onClick={(e) => {
              e.preventDefault()
              void onCrop()
            }}
          >
            <CropIcon className="mr-1.5 size-4" />
            {cropButtonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Helper function to center the crop
export function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
): Crop {
  return centerCrop(
    makeAspectCrop(
      {
        unit: "%",
        width: 50,
        height: 50,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}
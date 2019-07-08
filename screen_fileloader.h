#pragma once



#include "screen.h"



enum
{
    SCREEN_PATH_MAX = 512,
};



typedef enum SCREEN_LoadFileError
{
    SCREEN_LoadFileError_NONE = 0,

    SCREEN_LoadFileError_NoFile,
    SCREEN_LoadFileError_NoEntryFile,
    SCREEN_LoadFileError_FileUnkExt,
    SCREEN_LoadFileError_FileInvalid,

    SCREEN_NumLoadFileErrors
} SCREEN_LoadFileError;






















































































#pragma once



#include "screen.h"
#include <fileu.h>



enum
{
    SCREEN_PATH_BUF_MAX = FILEU_PATH_BUF_MAX,
};



typedef enum SCREEN_LoadFileError
{
    SCREEN_LoadFileError_NONE = 0,

    SCREEN_LoadFileError_NoFile,
    SCREEN_LoadFileError_NoEntryFile,
    SCREEN_LoadFileError_FileUnkExt,
    SCREEN_LoadFileError_FileInvalid,

    SCREEN_LoadFileErrorCount
} SCREEN_LoadFileError;






















































































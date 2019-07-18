#pragma once



#include "screen.h"

#include <vec.h>




void SCREEN_consoleStartup(void);
void SCREEN_consoleDestroy(void);
void SCREEN_consoleUpdate(void);




void SCREEN_cmdLoadScene
(
    vec_char* cmdBuf, const SCREEN_Scene* scene, const char* sceneData, u32 sceneDataSize
);
















































































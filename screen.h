#pragma once



#include <stdbool.h>


typedef unsigned char u8;
typedef unsigned short u16;
typedef unsigned int u32;
typedef unsigned long long u64;

typedef signed char s8;
typedef signed short s16;
typedef signed int s32;
typedef signed long long s64;

typedef float f32;
typedef double f64;





void SCREEN_startup(void);
void SCREEN_destroy(void);


void SCREEN_enter(u32 w, u32 h);
void SCREEN_leave(void);
void SCREEN_resize(u32 w, u32 h);


void SCREEN_frame(f32 time);



typedef struct SCREEN_SceneDesc
{
    const char* shaderMain;
} SCREEN_SceneDesc;

void SCREEN_loadScene(const SCREEN_SceneDesc* desc);
void SCREEN_unloadScene(void);



void SCREEN_mouseUp(int x, int y);
void SCREEN_mouseDown(int x, int y);
void SCREEN_mouseMotion(int x, int y, int dx, int dy);




























































































